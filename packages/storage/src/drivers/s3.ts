import { Readable } from 'node:stream';
import { S3mini, S3ServiceError, type S3Config } from 's3mini';
import {
	StorageNotFoundError,
	StorageOperationError,
	StorageUnsupportedOperationError,
} from '../helpers.js';
import type {
	StorageDriverContract,
	StorageListEntry,
	StorageMetaData,
} from '../types.js';
import { createS3AclClient } from './s3-acl.js';
import {
	assertStorageKey,
	createStorageDriver,
	normalizeStoragePrefix,
	storageBaseUrl,
	storageOperation,
	storageUrl,
} from './shared.js';

export type S3StorageClient = Pick<
	S3mini,
	| 'endpoint'
	| 'putAnyObject'
	| 'getObjectResponse'
	| 'objectExists'
	| 'copyObject'
	| 'deleteObject'
	| 'listObjectsPaged'
	| 'getPresignedUrl'
>;

export type S3StorageDriverConfig = { baseUrl?: string } & (
	| { options: S3Config }
	| {
			client: S3StorageClient;
			/** Transport for ACL requests. Match the client's custom fetch, if any. */
			fetch?: typeof globalThis.fetch;
			/** Timeout for ACL requests, in milliseconds. */
			requestAbortTimeout?: number;
	  }
);

/** Creates an S3-compatible storage driver using s3mini, without the AWS SDK. */
export function createS3StorageDriver(
	config: S3StorageDriverConfig,
): StorageDriverContract {
	const client =
		'client' in config ? config.client : new S3mini(config.options);
	const baseUrl = storageBaseUrl(config.baseUrl ?? client.endpoint.href);
	const transport = 'options' in config ? config.options : config;
	const acl = createS3AclClient({
		client,
		fetch: transport.fetch ?? globalThis.fetch,
		...(transport.requestAbortTimeout !== undefined
			? { requestAbortTimeout: transport.requestAbortTimeout }
			: {}),
	});

	const operation = async <T>(
		name: string,
		key: string,
		run: () => Promise<T>,
	): Promise<T> => {
		assertStorageKey(key);

		return storageOperation(name, key, async () => {
			try {
				return await run();
			} catch (error) {
				if (error instanceof S3ServiceError && error.status === 501) {
					throw new StorageUnsupportedOperationError('s3', name, {
						cause: error,
					});
				}

				if (
					error instanceof S3ServiceError &&
					error.status === 404 &&
					error.serviceCode !== 'NoSuchBucket'
				) {
					throw new StorageNotFoundError(key, { cause: error });
				}

				throw error;
			}
		});
	};

	const read = async (key: string): Promise<Response> => {
		const response = await client.getObjectResponse(key);

		if (!response) {
			throw new StorageNotFoundError(key);
		}

		if (!response.ok) {
			await response.body?.cancel();

			throw new StorageOperationError('get', key);
		}

		return response;
	};

	const remove: StorageDriverContract['delete'] = async ({ key }) => {
		try {
			await operation('delete', key, async () => {
				if (!(await client.deleteObject(key))) {
					throw new StorageOperationError('delete', key);
				}
			});
		} catch (error) {
			if (!(error instanceof StorageNotFoundError)) {
				throw error;
			}
		}
	};

	const copy: StorageDriverContract['copy'] = async ({
		source,
		destination,
	}) => {
		assertStorageKey(destination);

		await operation('copy', source, async () => {
			if (source === destination) {
				if (!(await client.objectExists(source))) {
					throw new StorageNotFoundError(source);
				}

				return;
			}

			await client.copyObject(source, destination);
		});
	};

	const expiresIn = (seconds = 1800): number => {
		if (!Number.isInteger(seconds) || seconds < 1 || seconds > 604800) {
			throw new RangeError(
				'Storage signed URL expiresIn must be an integer from 1 to 604800 seconds',
			);
		}

		return seconds;
	};

	const upload = async (
		key: string,
		contents: Parameters<S3StorageClient['putAnyObject']>[1],
		contentType?: string,
	): Promise<void> => {
		const result = await client.putAnyObject(
			key,
			contents,
			contentType ?? 'application/octet-stream',
		);

		if (result instanceof Response) {
			await result.body?.cancel();
		}

		if (!result.ok) {
			throw new StorageOperationError('put', key);
		}
	};

	return createStorageDriver({
		put: async ({ key, contents, contentType }) => {
			await operation('put', key, async () => {
				await upload(key, contents, contentType);
			});
		},
		putStream: async ({ key, contents, contentType }) => {
			await operation('putStream', key, async () => {
				// Node streams may yield strings; s3mini's multipart uploads require bytes.
				const chunks = (async function* () {
					for await (const chunk of contents as AsyncIterable<
						string | Uint8Array
					>) {
						const bytes =
							typeof chunk === 'string' ? Buffer.from(chunk) : chunk;

						if (!(bytes instanceof Uint8Array)) {
							throw new TypeError(
								'Storage streams must contain strings or bytes',
							);
						}

						if (bytes.byteLength > 0) {
							yield bytes;
						}
					}
				})();
				let bytes: Readable | undefined;

				try {
					const first = await chunks.next();

					// An empty stream needs a single PUT: S3 cannot complete a multipart
					// upload containing no parts. Peeking does not buffer the full file.
					if (first.done) {
						await upload(key, new Uint8Array(), contentType);

						return;
					}

					bytes = Readable.from(
						(async function* () {
							yield first.value;
							yield* chunks;
						})(),
					);
					await upload(key, Readable.toWeb(bytes), contentType);
				} finally {
					bytes?.destroy();
					contents.destroy();
				}
			});
		},
		getStream: async ({ key }) => {
			return operation('getStream', key, async () => {
				const response = await read(key);

				return response.body
					? Readable.fromWeb(response.body)
					: Readable.from([]);
			});
		},
		getMetaData: async ({ key }) => {
			return operation('getMetaData', key, async () => {
				const response = await read(key);

				try {
					const length = response.headers.get('content-length');
					const contentLength = length === null ? NaN : Number(length);

					if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
						throw new Error('S3 response has no valid content-length header');
					}

					const metadata: StorageMetaData = { contentLength };
					const contentType = response.headers.get('content-type');
					const etag = response.headers.get('etag');
					const modified = response.headers.get('last-modified');

					if (contentType) {
						metadata.contentType = contentType;
					}

					if (etag) {
						metadata.etag = etag;
					}

					if (modified && Number.isFinite(Date.parse(modified))) {
						metadata.lastModified = new Date(modified);
					}

					return metadata;
				} finally {
					// s3mini exposes response metadata through GET; stop the body once
					// headers are read instead of buffering the object for metadata.
					await response.body?.cancel();
				}
			});
		},
		exists: async ({ key }) => {
			return operation('exists', key, async () => {
				return (await client.objectExists(key)) === true;
			});
		},
		delete: remove,
		copy,
		move: async ({ source, destination }) => {
			await copy({ source, destination });

			if (source !== destination) {
				await remove({ key: source });
			}
		},
		listAll: async (input = {}) => {
			const prefix = normalizeStoragePrefix(input.prefix);
			const maxResults = input.maxResults ?? 1000;

			if (
				!Number.isSafeInteger(maxResults) ||
				maxResults < 1 ||
				maxResults > 1000
			) {
				throw new RangeError(
					'Storage maxResults must be an integer from 1 to 1000',
				);
			}

			return storageOperation('listAll', prefix, async () => {
				const page = await client.listObjectsPaged(
					'/',
					prefix,
					maxResults,
					input.paginationToken,
					input.recursive ? {} : { delimiter: '/' },
				);

				if (!page?.objects) {
					throw new StorageOperationError('listAll', prefix);
				}

				const objects: StorageListEntry[] = [];

				for (const entry of page.objects) {
					if (entry.Key.endsWith('/')) {
						if (!input.recursive) {
							objects.push({
								isFile: false,
								isDirectory: true,
								prefix: entry.Key,
							});
						}
					} else {
						objects.push({ isFile: true, isDirectory: false, key: entry.Key });
					}
				}

				return {
					objects,
					...(page.nextContinuationToken
						? { paginationToken: page.nextContinuationToken }
						: {}),
				};
			});
		},
		getVisibility: async ({ key }) => {
			return operation('getVisibility', key, async () => {
				return acl.getVisibility(key);
			});
		},
		setVisibility: async ({ key, visibility }) => {
			await operation('setVisibility', key, async () => {
				await acl.setVisibility(key, visibility);
			});
		},
		getUrl: async ({ key }) => {
			return storageUrl(baseUrl, key);
		},
		getSignedUrl: async (input) => {
			return operation('getSignedUrl', input.key, async () => {
				const query: Record<string, string> = {};

				if (input.contentType !== undefined) {
					query['response-content-type'] = input.contentType;
				}

				if (input.contentDisposition !== undefined) {
					query['response-content-disposition'] = input.contentDisposition;
				}

				return client.getPresignedUrl(
					'GET',
					input.key,
					expiresIn(input.expiresIn),
					query,
				);
			});
		},
		getSignedUploadUrl: async (input) => {
			return operation('getSignedUploadUrl', input.key, async () => {
				const headers: Record<string, string> = {};

				if (input.contentType !== undefined) {
					headers['Content-Type'] = input.contentType;
				}

				const url = await client.getPresignedUrl(
					'PUT',
					input.key,
					expiresIn(input.expiresIn),
					{},
					headers,
				);

				return { url, method: 'PUT' as const, headers };
			});
		},
	});
}
