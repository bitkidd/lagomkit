import { Readable } from 'node:stream';
import { S3mini, S3ServiceError } from 's3mini';
import { describe, expect, test, vi } from 'vitest';
import {
	createS3StorageDriver,
	StorageOperationError,
	StorageUnsupportedOperationError,
} from '#src/exports.js';
import { createS3Harness } from './_helpers.js';

function createClient() {
	return new S3mini({
		endpoint: 'https://storage.example.test/bucket',
		accessKeyId: 'test-key',
		secretAccessKey: 'test-secret',
		region: 'us-east-1',
		fetch: async () => {
			throw new Error('Unexpected HTTP request');
		},
	});
}

describe('Storage::S3', () => {
	test('signs downloads and uploads without making HTTP requests', async () => {
		const { driver, requests } = createS3Harness();
		const download = new URL(
			await driver.getSignedUrl({
				key: 'dir/a b.txt',
				expiresIn: 60,
				contentType: 'text/plain',
				contentDisposition: 'attachment; filename="a b.txt"',
			}),
		);
		expect(download.origin).toBe('https://storage.example.test');
		expect(download.pathname).toBe('/bucket/dir/a%20b.txt');
		expect(download.searchParams.get('X-Amz-Algorithm')).toBe(
			'AWS4-HMAC-SHA256',
		);
		expect(download.searchParams.get('X-Amz-Expires')).toBe('60');
		expect(download.searchParams.get('response-content-type')).toBe(
			'text/plain',
		);
		expect(download.searchParams.get('response-content-disposition')).toBe(
			'attachment; filename="a b.txt"',
		);
		expect(download.searchParams.get('X-Amz-Signature')).toMatch(
			/^[a-f0-9]{64}$/,
		);

		const upload = await driver.getSignedUploadUrl({
			key: 'dir/a b.txt',
			contentType: 'text/plain',
		});
		const uploadUrl = new URL(upload.url);
		expect(upload.method).toBe('PUT');
		expect(upload.headers).toEqual({ 'Content-Type': 'text/plain' });
		expect(uploadUrl.searchParams.get('X-Amz-SignedHeaders')).toContain(
			'content-type',
		);
		expect(uploadUrl.searchParams.get('X-Amz-Expires')).toBe('1800');
		expect(uploadUrl.searchParams.get('X-Amz-Signature')).not.toBe(
			download.searchParams.get('X-Amz-Signature'),
		);
		expect(requests).toHaveLength(0);
	});

	test.each([0, -1, 0.5, 604801, NaN, Infinity])(
		'rejects invalid signed URL lifetime %s',
		async (expiresIn) => {
			const { driver } = createS3Harness();
			await expect(
				driver.getSignedUrl({ key: 'file', expiresIn }),
			).rejects.toMatchObject({ cause: expect.any(RangeError) });
			await expect(
				driver.getSignedUploadUrl({ key: 'file', expiresIn }),
			).rejects.toMatchObject({ cause: expect.any(RangeError) });
		},
	);

	test('uses a signed single PUT for small known payloads and preserves content type', async () => {
		const { driver, requests, files } = createS3Harness();
		await driver.put({
			key: 'file.json',
			contents: '{}',
			contentType: 'application/json',
		});
		expect(requests).toHaveLength(1);
		expect(requests[0]?.method).toBe('PUT');
		expect(requests[0]?.headers.get('authorization')).toContain(
			'AWS4-HMAC-SHA256 Credential=test-key/',
		);
		expect(files.get('file.json')?.contentType).toBe('application/json');
	});

	test('uploads byte streams using multipart and aborts failed source streams', async () => {
		const { driver, uploads, requests } = createS3Harness();
		await driver.putStream({
			key: 'file',
			contents: Readable.from([new Uint8Array([0, 255]), Buffer.from([128])]),
		});
		expect([...(await driver.getBytes({ key: 'file' }))]).toEqual([
			0, 255, 128,
		]);
		expect(
			requests.some((request) =>
				new URL(request.url).searchParams.has('uploads'),
			),
		).toBe(true);

		const failure = new Error('Source failed');
		const contents = Readable.from(
			(async function* () {
				yield Buffer.from('partial');
				throw failure;
			})(),
		);
		await expect(
			driver.putStream({ key: 'failed', contents }),
		).rejects.toBeInstanceOf(StorageOperationError);
		expect(uploads.size).toBe(0);
		expect(contents.destroyed).toBe(true);
		expect(await driver.exists({ key: 'failed' })).toBe(false);
		expect(
			requests.some(
				(request) =>
					request.method === 'DELETE' &&
					new URL(request.url).searchParams.has('uploadId'),
			),
		).toBe(true);
	});

	test('surfaces authorization and service errors instead of reporting missing objects', async () => {
		const { driver, failures } = createS3Harness();
		for (const method of ['GET', 'HEAD', 'DELETE']) {
			failures.set(`${method}:file`, { status: 403, code: 'AccessDenied' });
		}

		await expect(driver.get({ key: 'file' })).rejects.toMatchObject({
			cause: expect.any(S3ServiceError),
		});
		await expect(driver.exists({ key: 'file' })).rejects.toBeInstanceOf(
			StorageOperationError,
		);
		await expect(driver.delete({ key: 'file' })).rejects.toBeInstanceOf(
			StorageOperationError,
		);
		failures.set('DELETE:file', { status: 404, code: 'NoSuchKey' });
		await expect(driver.delete({ key: 'file' })).resolves.toBeUndefined();
		failures.set('DELETE:file', { status: 404, code: 'NoSuchBucket' });
		await expect(driver.delete({ key: 'file' })).rejects.toBeInstanceOf(
			StorageOperationError,
		);
		failures.set('PUT:file', { status: 501, code: 'NotImplemented' });
		await expect(
			driver.put({ key: 'file', contents: 'value' }),
		).rejects.toBeInstanceOf(StorageUnsupportedOperationError);
	});

	test('never removes the source after a failed copy and surfaces failed move deletion', async () => {
		const { driver, failures } = createS3Harness();
		await driver.put({ key: 'source', contents: 'kept' });
		failures.set('PUT:destination', { status: 403, code: 'AccessDenied' });
		await expect(
			driver.move({ source: 'source', destination: 'destination' }),
		).rejects.toBeInstanceOf(StorageOperationError);
		expect(await driver.get({ key: 'source' })).toBe('kept');
		failures.clear();
		failures.set('DELETE:source', { status: 403, code: 'AccessDenied' });
		await expect(
			driver.move({ source: 'source', destination: 'destination' }),
		).rejects.toBeInstanceOf(StorageOperationError);
		expect(await driver.get({ key: 'source' })).toBe('kept');
		expect(await driver.get({ key: 'destination' })).toBe('kept');
	});

	test('paginates listings and deletes every page inside a prefix', async () => {
		const { driver, files } = createS3Harness();
		for (let index = 0; index < 1001; index += 1) {
			files.set(`uploads/${String(index).padStart(4, '0')}`, {
				bytes: new Uint8Array([index % 256]),
				contentType: 'application/octet-stream',
			});
		}
		files.set('uploads-backup/keep', {
			bytes: new Uint8Array(),
			contentType: 'application/octet-stream',
		});
		const first = await driver.listAll({
			prefix: 'uploads',
			recursive: true,
			maxResults: 1,
		});
		expect(first.objects).toEqual([
			{ isFile: true, isDirectory: false, key: 'uploads/0000' },
		]);
		expect(first.paginationToken).toBeDefined();

		if (!first.paginationToken) {
			throw new Error('Expected a continuation token');
		}

		const second = await driver.listAll({
			prefix: 'uploads',
			recursive: true,
			maxResults: 1,
			paginationToken: first.paginationToken,
		});
		expect(second.objects).toEqual([
			{ isFile: true, isDirectory: false, key: 'uploads/0001' },
		]);
		await driver.deleteAll({ prefix: 'uploads' });
		expect([...files.keys()]).toEqual(['uploads-backup/keep']);
	});

	test('reads metadata headers and cancels the response body without buffering it', async () => {
		const client = createClient();
		const cancel = vi.fn();
		vi.spyOn(client, 'getObjectResponse').mockResolvedValue(
			new Response(new ReadableStream({ cancel }), {
				headers: {
					'Content-Length': '123',
					'Content-Type': 'image/png',
					ETag: '"etag"',
				},
			}),
		);
		const driver = createS3StorageDriver({ client });
		expect(await driver.getMetaData({ key: 'file' })).toEqual({
			contentLength: 123,
			contentType: 'image/png',
			etag: '"etag"',
		});
		expect(cancel).toHaveBeenCalledOnce();

		const cancelInvalid = vi.fn();
		vi.mocked(client.getObjectResponse).mockResolvedValue(
			new Response(new ReadableStream({ cancel: cancelInvalid })),
		);
		await expect(driver.getMetaData({ key: 'invalid' })).rejects.toBeInstanceOf(
			StorageOperationError,
		);
		expect(cancelInvalid).toHaveBeenCalledOnce();
	});

	test('preserves transport failures as causes and uses the endpoint for unsigned URLs', async () => {
		const client = createClient();
		const failure = new Error('Connection refused');
		vi.spyOn(client, 'putAnyObject').mockRejectedValue(failure);
		const driver = createS3StorageDriver({ client });
		await expect(
			driver.put({ key: 'file', contents: '' }),
		).rejects.toMatchObject({ cause: failure });
		expect(await driver.getUrl({ key: 'dir/a b.txt' })).toBe(
			'https://storage.example.test/bucket/dir/a%20b.txt',
		);
	});
});
