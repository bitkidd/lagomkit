import { randomUUID } from 'node:crypto';
import { constants, createWriteStream } from 'node:fs';
import {
	lstat,
	mkdir,
	open,
	readdir,
	realpath,
	rename,
	stat,
	unlink,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { lookup } from 'mrmime';
import {
	StorageInvalidKeyError,
	StorageNotFoundError,
	StorageUnsupportedOperationError,
} from '../helpers.js';
import type {
	StorageDriverContract,
	StorageListEntry,
	StorageVisibility,
} from '../types.js';
import {
	assertStorageKey,
	createStorageDriver,
	isMissingFile,
	normalizeStoragePrefix,
	storageBaseUrl,
	storageOperation,
	storageSourcePath,
	storageUrl,
	TEMP_FILE_PREFIX,
} from './shared.js';

export type LocalStorageDriverConfig = {
	/** Application-owned storage directory. Created lazily if absent. */
	root: string;
	/** Public HTTP mount point, served by your application or web server. */
	baseUrl?: string;
	/** Describes the HTTP mount; does not change filesystem permissions. */
	visibility?: StorageVisibility;
};

/** Creates a local filesystem driver without installing an HTTP server. */
export function createLocalStorageDriver(
	config: LocalStorageDriverConfig,
): StorageDriverContract {
	if (config.root.trim().length === 0) {
		throw new TypeError('Local storage root must be a non-empty path');
	}

	const root = resolve(config.root);
	const baseUrl =
		config.baseUrl !== undefined ? storageBaseUrl(config.baseUrl) : undefined;
	const visibility = config.visibility ?? 'private';

	if (visibility !== 'public' && visibility !== 'private') {
		throw new TypeError('Local storage visibility must be public or private');
	}

	let rootPromise: Promise<string> | undefined;

	const getRoot = (): Promise<string> => {
		rootPromise ??= (async () => {
			await mkdir(root, { recursive: true });

			return realpath(root);
		})();

		return rootPromise;
	};

	/** Reject symlinks at every existing component, including destinations. */
	const filePath = async (
		key: string,
		createParents = false,
	): Promise<string> => {
		assertStorageKey(key);
		const parts = key.split('/');
		let current = await getRoot();
		const target = join(current, ...parts);

		for (let index = 0; index < parts.length; index += 1) {
			current = join(current, parts[index] as string);

			try {
				if (createParents && index < parts.length - 1) {
					await mkdir(current).catch((error: unknown) => {
						if (
							!(
								typeof error === 'object' &&
								error !== null &&
								'code' in error &&
								error.code === 'EEXIST'
							)
						) {
							throw error;
						}
					});
				}

				if ((await lstat(current)).isSymbolicLink()) {
					throw new StorageInvalidKeyError(key);
				}
			} catch (error) {
				if (isMissingFile(error) && !createParents) {
					break;
				}

				if (isMissingFile(error) && index === parts.length - 1) {
					break;
				}

				throw error;
			}
		}

		return target;
	};

	const getMetaData: StorageDriverContract['getMetaData'] = async ({ key }) => {
		return storageOperation('getMetaData', key, async () => {
			const info = await stat(await filePath(key));

			if (!info.isFile()) {
				throw new StorageNotFoundError(key);
			}

			return {
				contentLength: info.size,
				contentType: lookup(key) ?? 'application/octet-stream',
				lastModified: info.mtime,
				etag: `W/"${info.ino}-${info.size}-${info.mtimeMs}"`,
			};
		});
	};

	const copy: StorageDriverContract['copy'] = async ({
		source,
		destination,
	}) => {
		assertStorageKey(source);
		assertStorageKey(destination);

		await storageOperation('copy', source, async () => {
			await getMetaData({ key: source });
			await filePath(destination, true);

			if (source === destination) {
				return;
			}

			const stream = await driver.getStream({ key: source });

			await driver.putStream({ key: destination, contents: stream });
		});
	};

	const driver = createStorageDriver({
		putStream: async ({ key, contents }) => {
			await storageOperation('putStream', key, async () => {
				const target = await filePath(key, true);
				const temporary = join(
					dirname(target),
					`${TEMP_FILE_PREFIX}${randomUUID()}`,
				);

				try {
					// Publish completed writes atomically; failed streams leave existing
					// files intact and never expose a partial upload to readers.
					await pipeline(
						contents,
						createWriteStream(temporary, { flags: 'wx', mode: 0o600 }),
					);
					await rename(temporary, target);
				} finally {
					await unlink(temporary).catch((error: unknown) => {
						if (!isMissingFile(error)) {
							throw error;
						}
					});
				}
			});
		},
		getStream: async ({ key }) => {
			return storageOperation('getStream', key, async () => {
				const path = await filePath(key);
				const handle = await open(
					path,
					constants.O_RDONLY | constants.O_NOFOLLOW,
				);

				try {
					if (!(await handle.stat()).isFile()) {
						throw new StorageNotFoundError(key);
					}

					return handle.createReadStream();
				} catch (error) {
					await handle.close();

					throw error;
				}
			});
		},
		getMetaData,
		exists: async ({ key }) => {
			try {
				await getMetaData({ key });

				return true;
			} catch (error) {
				if (error instanceof StorageNotFoundError) {
					return false;
				}

				throw error;
			}
		},
		delete: async ({ key }) => {
			await storageOperation('delete', key, async () => {
				try {
					await unlink(await filePath(key));
				} catch (error) {
					if (!isMissingFile(error)) {
						throw error;
					}
				}
			});
		},
		copy,
		move: async ({ source, destination }) => {
			assertStorageKey(source);
			assertStorageKey(destination);

			await storageOperation('move', source, async () => {
				await getMetaData({ key: source });
				const from = await filePath(source);
				const to = await filePath(destination, true);

				if (source !== destination) {
					await rename(from, to);
				}
			});
		},
		listAll: async (input = {}) => {
			if (
				input.maxResults !== undefined ||
				input.paginationToken !== undefined
			) {
				throw new StorageUnsupportedOperationError(
					'local',
					'listAll.pagination',
				);
			}

			const prefix = normalizeStoragePrefix(input.prefix);

			return storageOperation('listAll', prefix, async () => {
				const objects: StorageListEntry[] = [];
				const start = prefix
					? await filePath(prefix.slice(0, -1))
					: await getRoot();

				const walk = async (
					directory: string,
					parent: string,
				): Promise<void> => {
					const entries = await readdir(directory, { withFileTypes: true });
					entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));

					for (const entry of entries) {
						if (
							entry.isSymbolicLink() ||
							entry.name.startsWith(TEMP_FILE_PREFIX)
						) {
							continue;
						}

						const key = `${parent}${entry.name}`;

						if (entry.isDirectory()) {
							if (input.recursive) {
								await walk(join(directory, entry.name), `${key}/`);
							} else {
								objects.push({
									isFile: false,
									isDirectory: true,
									prefix: `${key}/`,
								});
							}
						} else if (entry.isFile()) {
							objects.push({ isFile: true, isDirectory: false, key });
						}
					}
				};

				try {
					await walk(start, prefix);
				} catch (error) {
					if (!isMissingFile(error)) {
						throw error;
					}
				}

				return { objects };
			});
		},
		getVisibility: async ({ key }) => {
			assertStorageKey(key);

			return visibility;
		},
		setVisibility: async () => {
			throw new StorageUnsupportedOperationError('local', 'setVisibility');
		},
		getUrl: async ({ key }) => {
			assertStorageKey(key);

			if (!baseUrl) {
				throw new StorageUnsupportedOperationError('local', 'getUrl');
			}

			return storageUrl(baseUrl, key);
		},
		getSignedUrl: async () => {
			throw new StorageUnsupportedOperationError('local', 'getSignedUrl');
		},
		getSignedUploadUrl: async () => {
			throw new StorageUnsupportedOperationError('local', 'getSignedUploadUrl');
		},
	});

	return {
		...driver,
		moveFromFs: async (input) => {
			assertStorageKey(input.destination);
			const source = storageSourcePath(input.source);
			const canonicalSource = await storageOperation(
				'moveFromFs',
				source,
				async () => {
					return realpath(source);
				},
			);
			const destination = await storageOperation(
				'moveFromFs',
				input.destination,
				async () => {
					return filePath(input.destination, true);
				},
			);

			// Moving an existing local file onto itself must never unlink it.
			if (canonicalSource === destination) {
				await getMetaData({ key: input.destination });

				return;
			}

			await driver.moveFromFs(input);
		},
	};
}
