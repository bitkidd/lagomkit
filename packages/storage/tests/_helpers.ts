import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	createLocalStorageDriver,
	createS3StorageDriver,
} from '#src/exports.js';

function xml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

/** In-memory HTTP transport: tests still exercise s3mini signing and XML parsing. */
export function createS3Harness() {
	const files = new Map<
		string,
		{ bytes: Uint8Array<ArrayBuffer>; contentType: string }
	>();
	const requests: Request[] = [];
	const failures = new Map<string, { status: number; code: string }>();
	const acls = new Map<string, string>();
	const uploads = new Map<
		string,
		{
			key: string;
			contentType: string;
			parts: Map<number, Uint8Array<ArrayBuffer>>;
		}
	>();
	let sequence = 0;

	const error = (status: number, code: string): Response => {
		return new Response(
			`<Error><Code>${code}</Code><Message>${code}</Message></Error>`,
			{
				status,
				headers: { 'Content-Type': 'application/xml' },
			},
		);
	};

	const fetch: typeof globalThis.fetch = async (input, init) => {
		const request = new Request(input, {
			...init,
			...(init?.body instanceof ReadableStream ? { duplex: 'half' } : {}),
		});
		requests.push(request);
		const url = new URL(request.url);
		const key = decodeURIComponent(url.pathname.replace(/^\/bucket\/?/, ''));
		const failure =
			failures.get(
				`${request.method}:${key}${url.searchParams.has('acl') ? '?acl' : ''}`,
			) ?? failures.get(`${request.method}:${key}`);

		if (failure) {
			return error(failure.status, failure.code);
		}

		if (url.searchParams.has('acl')) {
			if (!files.has(key)) {
				return error(404, 'NoSuchKey');
			}

			if (request.method === 'PUT') {
				if (request.headers.get('content-md5') !== '1B2M2Y8AsgTpgAmY7PhCfg==') {
					return error(400, 'InvalidDigest');
				}

				const publicRead = request.headers.get('x-amz-acl') === 'public-read';
				acls.set(
					key,
					`<AccessControlPolicy xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Owner><ID>owner</ID></Owner><AccessControlList><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser"><ID>owner</ID></Grantee><Permission>FULL_CONTROL</Permission></Grant>${publicRead ? '<Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="Group"><URI>http://acs.amazonaws.com/groups/global/AllUsers</URI></Grantee><Permission>READ</Permission></Grant>' : ''}</AccessControlList></AccessControlPolicy>`,
				);

				return new Response(null);
			}

			return new Response(
				acls.get(key) ??
					'<AccessControlPolicy><Owner><ID>owner</ID></Owner><AccessControlList><Grant><Grantee><ID>owner</ID></Grantee><Permission>FULL_CONTROL</Permission></Grant></AccessControlList></AccessControlPolicy>',
				{
					headers: { 'Content-Type': 'application/xml' },
				},
			);
		}

		if (request.method === 'GET' && url.searchParams.has('list-type')) {
			const prefix = url.searchParams.get('prefix') ?? '';
			const delimiter = url.searchParams.get('delimiter');
			const after = url.searchParams.get('continuation-token') ?? '';
			const entries = new Map<string, boolean>();

			for (const name of files.keys()) {
				if (!name.startsWith(prefix)) {
					continue;
				}

				const nested = name.slice(prefix.length).indexOf('/');

				if (delimiter && nested !== -1) {
					entries.set(name.slice(0, prefix.length + nested + 1), true);
				} else {
					entries.set(name, false);
				}
			}

			const sorted = [...entries.keys()].sort().filter((name) => name > after);
			const page = sorted.slice(
				0,
				Number(url.searchParams.get('max-keys') ?? 1000),
			);
			const truncated = page.length < sorted.length;
			const contents = page
				.map((name) => {
					if (entries.get(name)) {
						return `<CommonPrefixes><Prefix>${xml(name)}</Prefix></CommonPrefixes>`;
					}

					return `<Contents><Key>${xml(name)}</Key><Size>${files.get(name)?.bytes.length}</Size><LastModified>2026-01-01T00:00:00Z</LastModified><ETag>"etag"</ETag></Contents>`;
				})
				.join('');

			return new Response(
				`<ListBucketResult><IsTruncated>${truncated}</IsTruncated>${contents}${truncated ? `<NextContinuationToken>${xml(page.at(-1) ?? '')}</NextContinuationToken>` : ''}</ListBucketResult>`,
			);
		}

		if (request.method === 'POST' && url.searchParams.has('uploads')) {
			const id = `upload-${++sequence}`;
			uploads.set(id, {
				key,
				contentType:
					request.headers.get('content-type') ?? 'application/octet-stream',
				parts: new Map(),
			});

			return new Response(
				`<InitiateMultipartUploadResult><Bucket>bucket</Bucket><Key>${xml(key)}</Key><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`,
			);
		}

		const uploadId = url.searchParams.get('uploadId');

		if (uploadId) {
			const upload = uploads.get(uploadId);

			if (!upload) {
				return error(404, 'NoSuchUpload');
			}

			if (request.method === 'PUT') {
				upload.parts.set(
					Number(url.searchParams.get('partNumber')),
					new Uint8Array(await request.arrayBuffer()),
				);

				return new Response(null, { headers: { ETag: '"part-etag"' } });
			}

			if (request.method === 'POST') {
				const parts = [...upload.parts]
					.sort(([a], [b]) => a - b)
					.map(([, bytes]) => bytes);
				files.set(key, {
					bytes: new Uint8Array(Buffer.concat(parts)),
					contentType: upload.contentType,
				});
				uploads.delete(uploadId);

				return new Response(
					`<CompleteMultipartUploadResult><Location>https://storage.example.test/bucket/${xml(key)}</Location><Bucket>bucket</Bucket><Key>${xml(key)}</Key><ETag>"complete-etag"</ETag></CompleteMultipartUploadResult>`,
				);
			}

			uploads.delete(uploadId);

			return new Response(null, { status: 204 });
		}

		if (request.method === 'PUT') {
			const copySource = request.headers.get('x-amz-copy-source');

			if (copySource) {
				const source = files.get(
					decodeURIComponent(copySource.replace(/^\/bucket\//, '')),
				);

				if (!source) {
					return error(404, 'NoSuchKey');
				}

				files.set(key, { ...source, bytes: new Uint8Array(source.bytes) });

				return new Response(
					'<CopyObjectResult><ETag>"copy-etag"</ETag><LastModified>2026-01-01T00:00:00Z</LastModified></CopyObjectResult>',
				);
			}

			files.set(key, {
				bytes: new Uint8Array(await request.arrayBuffer()),
				contentType:
					request.headers.get('content-type') ?? 'application/octet-stream',
			});

			return new Response(null, { headers: { ETag: '"put-etag"' } });
		}

		if (request.method === 'DELETE') {
			files.delete(key);

			return new Response(null, { status: 204 });
		}

		const file = files.get(key);

		if (!file) {
			return error(404, 'NoSuchKey');
		}

		return new Response(request.method === 'HEAD' ? null : file.bytes, {
			headers: {
				'Content-Length': String(file.bytes.length),
				'Content-Type': file.contentType,
				ETag: '"object-etag"',
				'Last-Modified': 'Thu, 01 Jan 2026 00:00:00 GMT',
			},
		});
	};

	const driver = createS3StorageDriver({
		baseUrl: 'https://cdn.example.test/assets',
		options: {
			endpoint: 'https://storage.example.test/bucket',
			accessKeyId: 'test-key',
			secretAccessKey: 'test-secret',
			region: 'us-east-1',
			fetch,
		},
	});

	return { driver, requests, files, failures, uploads, acls };
}

export async function createHarness(kind: 'local' | 's3') {
	const directory = await mkdtemp(join(tmpdir(), 'lagomkit-storage-'));
	const root = join(directory, 'root');
	const remote = createS3Harness();
	const driver =
		kind === 'local'
			? createLocalStorageDriver({
					root,
					baseUrl: 'https://cdn.example.test/assets',
				})
			: remote.driver;

	return {
		driver,
		directory,
		root,
		remote,
		close: async () => {
			await rm(directory, { recursive: true, force: true });
		},
	};
}
