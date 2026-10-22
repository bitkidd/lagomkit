import { open, unlink } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import {
	StorageError,
	StorageInvalidKeyError,
	StorageNotFoundError,
	StorageOperationError,
} from '../helpers.js';
import type { StorageDriverContract } from '../types.js';

export const TEMP_FILE_PREFIX = '.lagomkit-upload-';

/** Reject ambiguous keys instead of silently resolving traversal segments. */
export function assertStorageKey(key: string): void {
	if (
		typeof key !== 'string' ||
		key.trim().length === 0 ||
		/[\\:]/.test(key) ||
		Array.from(key).some((character) => {
			return character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127;
		}) ||
		key.startsWith('/') ||
		key.split('/').some((part) => {
			return (
				!part ||
				part === '.' ||
				part === '..' ||
				part.startsWith(TEMP_FILE_PREFIX)
			);
		})
	) {
		throw new StorageInvalidKeyError(key);
	}
}

/** Prefixes represent directories, so `uploads` never matches `uploads-backup`. */
export function normalizeStoragePrefix(prefix: string = ''): string {
	if (prefix === '' || prefix === '/') {
		return '';
	}

	const key = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
	assertStorageKey(key);

	return `${key}/`;
}

export function isMissingFile(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error.code === 'ENOENT' || error.code === 'ENOTDIR')
	);
}

export async function storageOperation<T>(
	operation: string,
	key: string,
	run: () => Promise<T>,
): Promise<T> {
	try {
		return await run();
	} catch (error) {
		if (error instanceof StorageError) {
			throw error;
		}

		if (isMissingFile(error)) {
			throw new StorageNotFoundError(key, { cause: error });
		}

		throw new StorageOperationError(operation, key, { cause: error });
	}
}

export function storageBaseUrl(value: string): URL {
	const url = new URL(value);

	if (
		!['http:', 'https:'].includes(url.protocol) ||
		url.search ||
		url.hash ||
		url.username ||
		url.password
	) {
		throw new TypeError(
			'Storage baseUrl must be an HTTP(S) URL without credentials, query, or fragment',
		);
	}

	if (!url.pathname.endsWith('/')) {
		url.pathname += '/';
	}

	return url;
}

export function storageUrl(base: URL, key: string): string {
	assertStorageKey(key);

	return new URL(key.split('/').map(encodeURIComponent).join('/'), base).href;
}

export function storageSourcePath(input: string | URL): string {
	const source = input instanceof URL ? fileURLToPath(input) : input;

	if (!isAbsolute(source)) {
		throw new TypeError(
			'Storage filesystem source must be an absolute path or file URL',
		);
	}

	return source;
}

type StorageAdapter = Omit<
	StorageDriverContract,
	'put' | 'get' | 'getBytes' | 'copyFromFs' | 'moveFromFs' | 'deleteAll'
> & { put?: StorageDriverContract['put'] };

/** Shared convenience methods keep stream handling and error semantics uniform. */
export function createStorageDriver(
	adapter: StorageAdapter,
): StorageDriverContract {
	const getBytes: StorageDriverContract['getBytes'] = async ({ key }) => {
		assertStorageKey(key);

		return storageOperation('getBytes', key, async () => {
			const stream = await adapter.getStream({ key });
			const chunks: Uint8Array[] = [];

			for await (const chunk of stream as AsyncIterable<Uint8Array | string>) {
				chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
			}

			return Buffer.concat(chunks);
		});
	};

	const copyFromFs: StorageDriverContract['copyFromFs'] = async (input) => {
		assertStorageKey(input.destination);
		const source = storageSourcePath(input.source);

		await storageOperation('copyFromFs', source, async () => {
			const handle = await open(source, 'r');
			let stream: Readable | undefined;

			try {
				if (!(await handle.stat()).isFile()) {
					throw new TypeError(
						'Storage filesystem source must be a regular file',
					);
				}

				stream = handle.createReadStream();
				await adapter.putStream({
					key: input.destination,
					contents: stream,
					...(input.contentType !== undefined
						? { contentType: input.contentType }
						: {}),
				});
			} finally {
				stream?.destroy();
				await handle.close();
			}
		});
	};

	return {
		...adapter,
		put:
			adapter.put ??
			(async ({ contents, ...input }) => {
				await adapter.putStream({
					...input,
					contents: Readable.from([contents]),
				});
			}),
		get: async (input) => {
			return new TextDecoder().decode(await getBytes(input));
		},
		getBytes,
		copyFromFs,
		moveFromFs: async (input) => {
			await copyFromFs(input);
			const source = storageSourcePath(input.source);

			await storageOperation('moveFromFs', source, async () => {
				await unlink(source);
			});
		},
		deleteAll: async ({ prefix }) => {
			if (typeof prefix !== 'string' || prefix === '') {
				throw new StorageInvalidKeyError(prefix);
			}

			const directory = normalizeStoragePrefix(prefix);
			let paginationToken: string | undefined;
			const seen = new Set<string>();

			do {
				const page = await adapter.listAll({
					prefix: directory,
					recursive: true,
					...(paginationToken !== undefined ? { paginationToken } : {}),
				});

				for (const entry of page.objects) {
					if (entry.isFile) {
						if (!entry.key.startsWith(directory)) {
							throw new StorageOperationError('deleteAll', prefix);
						}

						await adapter.delete({ key: entry.key });
					}
				}

				paginationToken = page.paginationToken;

				if (paginationToken && seen.has(paginationToken)) {
					throw new StorageOperationError('deleteAll', prefix);
				}

				if (paginationToken) {
					seen.add(paginationToken);
				}
			} while (paginationToken);
		},
	};
}
