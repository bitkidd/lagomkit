import { createHash } from 'node:crypto';
import { S3mini, S3ServiceError } from 's3mini';
import { describe, expect, test, vi } from 'vitest';
import {
	createS3StorageDriver,
	StorageInvalidKeyError,
	StorageNotFoundError,
	StorageOperationError,
	StorageUnsupportedOperationError,
} from '#src/exports.js';
import { createS3Harness } from './_helpers.js';

const options = {
	endpoint: 'https://storage.example.test/bucket',
	accessKeyId: 'test-key',
	secretAccessKey: 'test-secret',
	region: 'us-east-1',
};

describe('Storage::S3::Visibility', () => {
	test('changes private and public-read ACLs without replacing object contents', async () => {
		const { driver, requests } = createS3Harness();
		const key = 'dir/a b#?%.txt';
		await driver.put({ key, contents: 'unchanged', contentType: 'text/plain' });
		expect(await driver.getVisibility({ key })).toBe('private');
		await driver.setVisibility({ key, visibility: 'public' });
		expect(await driver.getVisibility({ key })).toBe('public');
		await driver.setVisibility({ key, visibility: 'private' });
		expect(await driver.getVisibility({ key })).toBe('private');
		expect(await driver.get({ key })).toBe('unchanged');
		expect((await driver.getMetaData({ key })).contentType).toBe('text/plain');

		const changes = requests.filter(
			(request) =>
				request.method === 'PUT' &&
				new URL(request.url).searchParams.has('acl'),
		);
		expect(changes).toHaveLength(2);
		expect(changes.map((request) => request.headers.get('x-amz-acl'))).toEqual([
			'public-read',
			'private',
		]);

		for (const request of changes) {
			const url = new URL(request.url);
			expect(url.origin).toBe('https://storage.example.test');
			expect(url.pathname).toBe('/bucket/dir/a%20b%23%3F%25.txt');
			expect(url.searchParams.get('acl')).toBe('');
			expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe(
				'content-md5;host;x-amz-acl',
			);
			expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[a-f0-9]{64}$/);
			expect(request.redirect).toBe('error');
			const body = await request.text();
			expect(body).toBe('');
			expect(request.headers.get('content-md5')).toBe(
				createHash('md5').update(body).digest('base64'),
			);
		}
	});

	test.each([
		['http://acs.amazonaws.com/groups/global/AllUsers', 'READ', 'public'],
		[
			'http://acs.amazonaws.com/groups/global/AllUsers',
			'FULL_CONTROL',
			'public',
		],
		['http://acs.amazonaws.com/groups/global/AllUsers', 'READ_ACP', 'private'],
		['http://acs.amazonaws.com/groups/global/AllUsers', 'WRITE', 'private'],
		[
			'http://acs.amazonaws.com/groups/global/AuthenticatedUsers',
			'READ',
			'private',
		],
		['http://example.test/AllUsers', 'READ', 'private'],
	])(
		'reads anonymous read grants: %s %s => %s',
		async (uri, permission, expected) => {
			const { driver, acls } = createS3Harness();
			await driver.put({ key: 'file', contents: '' });
			acls.set(
				'file',
				`<AccessControlPolicy xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Owner><ID>owner</ID></Owner><AccessControlList><Grant><Grantee><ID>owner</ID></Grantee><Permission>FULL_CONTROL</Permission></Grant><Grant><Grantee><URI>${uri}</URI></Grantee><Permission>${permission}</Permission></Grant></AccessControlList></AccessControlPolicy>`,
			);
			expect(await driver.getVisibility({ key: 'file' })).toBe(expected);
		},
	);

	test('handles namespace prefixes, XML entities, and separate grants correctly', async () => {
		const { driver, acls } = createS3Harness();
		await driver.put({ key: 'file', contents: '' });
		acls.set(
			'file',
			`<?xml version="1.0"?>
			<s3:AccessControlPolicy xmlns:s3="http://s3.amazonaws.com/doc/2006-03-01/">
				<s3:AccessControlList>
					<!-- Reading the ACL is different from reading the object. -->
					<s3:Grant><s3:Grantee><s3:URI>http://acs.amazonaws.com/groups/global/All&#85;sers</s3:URI></s3:Grantee><s3:Permission> READ_ACP </s3:Permission></s3:Grant>
					<s3:Grant><s3:Grantee><s3:ID>another-account</s3:ID></s3:Grantee><s3:Permission>READ</s3:Permission></s3:Grant>
				</s3:AccessControlList>
			</s3:AccessControlPolicy>`,
		);
		expect(await driver.getVisibility({ key: 'file' })).toBe('private');
		acls.set('file', acls.get('file')?.replace(' READ_ACP ', ' READ ') ?? '');
		expect(await driver.getVisibility({ key: 'file' })).toBe('public');
	});

	test.each([
		[400, 'AccessControlListNotSupported'],
		[501, 'NotImplemented'],
		[405, 'MethodNotAllowed'],
		[400, 'NotImplemented'],
		[400, 'NotSupported'],
		[400, 'OperationNotSupported'],
		[400, 'UnsupportedOperation'],
	] as const)(
		'maps unsupported ACL responses %s %s for both methods',
		async (status, code) => {
			const { driver, failures } = createS3Harness();
			failures.set('GET:file?acl', { status, code });
			failures.set('PUT:file?acl', { status, code });

			await expect(driver.getVisibility({ key: 'file' })).rejects.toMatchObject(
				{
					name: 'StorageUnsupportedOperationError',
					driver: 's3',
					operation: 'getVisibility',
					cause: expect.objectContaining({ status, serviceCode: code }),
				},
			);
			await expect(
				driver.setVisibility({ key: 'file', visibility: 'public' }),
			).rejects.toMatchObject({
				name: 'StorageUnsupportedOperationError',
				driver: 's3',
				operation: 'setVisibility',
				cause: expect.objectContaining({ status, serviceCode: code }),
			});
		},
	);

	test('preserves ACLs after denied changes and keeps access errors distinct from unsupported operations', async () => {
		const { driver, failures } = createS3Harness();
		await driver.put({ key: 'file', contents: 'kept' });
		await driver.setVisibility({ key: 'file', visibility: 'public' });
		failures.set('PUT:file?acl', { status: 403, code: 'AccessDenied' });
		await expect(
			driver.setVisibility({ key: 'file', visibility: 'private' }),
		).rejects.toBeInstanceOf(StorageOperationError);
		expect(await driver.getVisibility({ key: 'file' })).toBe('public');
		failures.set('GET:file?acl', { status: 403, code: 'AccessDenied' });
		await expect(driver.getVisibility({ key: 'file' })).rejects.toMatchObject({
			name: 'StorageOperationError',
			cause: expect.objectContaining({ serviceCode: 'AccessDenied' }),
		});
		expect(await driver.get({ key: 'file' })).toBe('kept');
	});

	test('reports missing objects and buckets without creating objects on ACL writes', async () => {
		const { driver, files, failures } = createS3Harness();
		await expect(
			driver.getVisibility({ key: 'missing' }),
		).rejects.toBeInstanceOf(StorageNotFoundError);
		await expect(
			driver.setVisibility({ key: 'missing', visibility: 'public' }),
		).rejects.toBeInstanceOf(StorageNotFoundError);
		expect(files.size).toBe(0);
		failures.set('GET:file?acl', { status: 404, code: 'NoSuchBucket' });
		failures.set('PUT:file?acl', { status: 404, code: 'NoSuchBucket' });
		await expect(driver.getVisibility({ key: 'file' })).rejects.toBeInstanceOf(
			StorageOperationError,
		);
		await expect(
			driver.setVisibility({ key: 'file', visibility: 'public' }),
		).rejects.toBeInstanceOf(StorageOperationError);
	});

	test.each([
		'',
		'not XML',
		'<AccessControlPolicy>',
		'<html><body>No ACL support</body></html>',
		'<AccessControlPolicy/>',
		'<AccessControlPolicy><AccessControlList><Grant><Grantee/></Grant></AccessControlList></AccessControlPolicy>',
		'<!DOCTYPE a [<!ENTITY uri SYSTEM "file:///etc/passwd">]><AccessControlPolicy><AccessControlList><Grant><Grantee><URI>&uri;</URI></Grantee><Permission>READ</Permission></Grant></AccessControlList></AccessControlPolicy>',
	])(
		'rejects malformed or unexpected ACL responses instead of reporting private: %j',
		async (body) => {
			const { driver, acls } = createS3Harness();
			await driver.put({ key: 'file', contents: '' });
			acls.set('file', body);
			await expect(
				driver.getVisibility({ key: 'file' }),
			).rejects.toBeInstanceOf(StorageOperationError);
		},
	);

	test('validates keys and visibility before making requests', async () => {
		const { driver, requests } = createS3Harness();
		for (const key of ['', '../file', '/absolute', 'a\\b']) {
			await expect(driver.getVisibility({ key })).rejects.toBeInstanceOf(
				StorageInvalidKeyError,
			);
			await expect(
				driver.setVisibility({ key, visibility: 'public' }),
			).rejects.toBeInstanceOf(StorageInvalidKeyError);
		}

		await expect(
			driver.setVisibility({
				key: 'file',
				// @ts-expect-error JavaScript callers must not send arbitrary canned ACLs
				visibility: 'public-read-write',
			}),
		).rejects.toMatchObject({ cause: expect.any(TypeError) });
		expect(requests).toHaveLength(0);
	});

	test('supports custom transports with existing clients and cancels successful PUT response bodies', async () => {
		const cancel = vi.fn();
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValue(new Response(new ReadableStream({ cancel })));
		const client = new S3mini(options);
		const driver = createS3StorageDriver({
			client,
			fetch,
			requestAbortTimeout: 1000,
		});
		await driver.setVisibility({ key: 'file', visibility: 'private' });
		expect(cancel).toHaveBeenCalledOnce();
		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining('acl='),
			expect.objectContaining({
				method: 'PUT',
				headers: expect.objectContaining({ 'x-amz-acl': 'private' }),
				signal: expect.any(AbortSignal),
			}),
		);
	});

	test.each(['options', 'client'] as const)(
		'preserves network failures using %s configuration',
		async (kind) => {
			const failure = new Error('Connection refused');
			const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(failure);
			const driver =
				kind === 'options'
					? createS3StorageDriver({ options: { ...options, fetch } })
					: createS3StorageDriver({ client: new S3mini(options), fetch });
			await expect(driver.getVisibility({ key: 'file' })).rejects.toMatchObject(
				{ cause: failure },
			);
			await expect(
				driver.setVisibility({ key: 'file', visibility: 'private' }),
			).rejects.toMatchObject({ cause: failure });
		},
	);

	test('honors configured request timeouts for ACL requests', async () => {
		const fetch: typeof globalThis.fetch = async (_input, init) => {
			const signal = init?.signal;

			if (!signal) {
				throw new Error('Expected an abort signal');
			}

			return new Promise((_resolve, reject) => {
				signal.addEventListener('abort', () => reject(signal.reason), {
					once: true,
				});
			});
		};
		const driver = createS3StorageDriver({
			options: { ...options, fetch, requestAbortTimeout: 5 },
		});
		await expect(driver.getVisibility({ key: 'file' })).rejects.toMatchObject({
			cause: expect.objectContaining({ name: 'TimeoutError' }),
		});
	});

	test.each([
		{
			status: 400,
			body: '<s3:Error xmlns:s3="urn:s3"><s3:Code>AccessControlListNotSupported</s3:Code></s3:Error>',
			headers: { 'Content-Type': 'application/xml; charset=utf-8' },
		},
		{
			status: 400,
			body: '',
			headers: { 'x-amz-error-code': 'AccessControlListNotSupported' },
		},
		{ status: 501, body: 'Not implemented', headers: {} },
		{ status: 405, body: '<html>Unsupported</html>', headers: {} },
	])(
		'handles provider-specific error bodies: %j',
		async ({ status, body, headers }) => {
			const fetch = vi
				.fn<typeof globalThis.fetch>()
				.mockImplementation(
					async () => new Response(body, { status, headers }),
				);
			const driver = createS3StorageDriver({ options: { ...options, fetch } });
			await expect(
				driver.setVisibility({ key: 'file', visibility: 'public' }),
			).rejects.toBeInstanceOf(StorageUnsupportedOperationError);
		},
	);

	test('preserves unrecognized HTTP errors with their status and response body', async () => {
		const driver = createS3StorageDriver({
			options: {
				...options,
				fetch: async () => new Response('upstream failed', { status: 500 }),
			},
		});
		await expect(driver.getVisibility({ key: 'file' })).rejects.toMatchObject({
			name: 'StorageOperationError',
			cause: expect.any(S3ServiceError),
		});
		await expect(
			driver.setVisibility({ key: 'file', visibility: 'public' }),
		).rejects.toMatchObject({
			cause: expect.objectContaining({ status: 500, body: 'upstream failed' }),
		});
	});
});
