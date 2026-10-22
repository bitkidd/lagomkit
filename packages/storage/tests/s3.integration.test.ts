import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	createS3StorageDriver,
	StorageNotFoundError,
	StorageOperationError,
	type StorageDriverContract,
} from '#src/exports.js';

describe.skipIf(process.env.LAGOMKIT_STORAGE_INTEGRATION !== '1')(
	'Storage::S3::Integration',
	{ concurrent: false },
	() => {
		const prefix = `lagomkit-integration/${randomUUID()}`;
		let driver: StorageDriverContract;
		let redactions: string[] = [];
		let uploadedParts = 0;
		let abortedUploads = 0;

		// Provider errors may contain credentials or signed URLs in their cause.
		// Report useful error messages without serializing those raw error objects.
		const safely = async (run: () => Promise<void>): Promise<void> => {
			try {
				await run();
			} catch (error) {
				const messages: string[] = [];
				let current = error;

				for (let depth = 0; current instanceof Error && depth < 5; depth += 1) {
					messages.push(current.message);
					current = current.cause;
				}

				let message = messages.join(': ') || 'S3 integration operation failed';

				for (const value of redactions) {
					message = message.replaceAll(value, '[redacted]');
				}

				throw new Error(
					message.replace(/https?:\/\/[^\s<>"']+/g, '[redacted URL]'),
				);
			}
		};

		const liveTest = (name: string, run: () => Promise<void>): void => {
			test(name, async () => safely(run), 60_000);
		};

		beforeAll(
			async () =>
				safely(async () => {
					let fileEnv: NodeJS.Dict<string> = {};

					try {
						fileEnv = parseEnv(
							await readFile(new URL('../.env', import.meta.url), 'utf8'),
						);
					} catch (error) {
						if (
							!(
								error instanceof Error &&
								'code' in error &&
								error.code === 'ENOENT'
							)
						) {
							throw error;
						}
					}

					const env = { ...fileEnv, ...process.env };
					redactions = Object.entries(env)
						.filter(([name, value]) => name.startsWith('S3_') && Boolean(value))
						.map(([, value]) => value as string);

					const required = (name: string): string => {
						const value = env[name];

						if (!value?.trim()) {
							throw new Error(
								`Missing integration environment variable: ${name}`,
							);
						}

						return value;
					};

					driver = createS3StorageDriver({
						options: {
							endpoint: required('S3_ENDPOINT'),
							accessKeyId: required('S3_ACCESS_KEY_ID'),
							secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
							region: env.S3_REGION || 'us-east-1',
							requestAbortTimeout: 30_000,
							fetch: async (input, init) => {
								const url = new URL(
									input instanceof Request ? input.url : input,
								);
								const response = await fetch(input, init);

								if (
									response.ok &&
									init?.method === 'PUT' &&
									url.searchParams.has('partNumber')
								) {
									uploadedParts += 1;
								}

								if (
									response.ok &&
									init?.method === 'DELETE' &&
									url.searchParams.has('uploadId')
								) {
									abortedUploads += 1;
								}

								return response;
							},
						},
					});
				}),
			30_000,
		);

		afterAll(
			async () =>
				safely(async () => {
					if (driver) {
						// Only this run's UUID prefix is ever listed or deleted.
						await driver.deleteAll({ prefix });
						expect(
							(await driver.listAll({ prefix, recursive: true })).objects,
						).toEqual([]);
					}
				}),
			120_000,
		);

		liveTest(
			'round-trips text, binary, empty files, overwrites, and encoded keys',
			async () => {
				const key = `${prefix}/roundtrip/hello 世界 #?%.txt`;
				await driver.put({
					key,
					contents: 'Hello, 世界',
					contentType: 'text/plain',
				});
				expect(await driver.get({ key })).toBe('Hello, 世界');
				expect(await driver.exists({ key })).toBe(true);
				expect(await driver.getMetaData({ key })).toMatchObject({
					contentLength: Buffer.byteLength('Hello, 世界'),
					contentType: 'text/plain',
					etag: expect.any(String),
					lastModified: expect.any(Date),
				});
				const binary = new Uint8Array([0, 255, 13, 128]);
				await driver.put({ key, contents: binary });
				expect([...(await driver.getBytes({ key }))]).toEqual([...binary]);
				await driver.put({ key: `${prefix}/empty`, contents: '' });
				await driver.putStream({
					key: `${prefix}/empty-stream`,
					contents: Readable.from([]),
				});
				expect(await driver.getBytes({ key: `${prefix}/empty` })).toHaveLength(
					0,
				);
				expect(
					await driver.getBytes({ key: `${prefix}/empty-stream` }),
				).toHaveLength(0);
			},
		);

		liveTest(
			'uploads multiple stream parts and downloads the complete stream',
			async () => {
				const key = `${prefix}/multipart/data.bin`;
				const bytes = Buffer.alloc(9 * 1024 * 1024, 137);
				const before = uploadedParts;
				const contents = Readable.from(
					(function* () {
						for (let offset = 0; offset < bytes.length; offset += 1024 * 1024) {
							yield bytes.subarray(offset, offset + 1024 * 1024);
						}
					})(),
				);
				await driver.putStream({ key, contents });
				expect(uploadedParts - before).toBeGreaterThanOrEqual(2);
				expect((await driver.getMetaData({ key })).contentLength).toBe(
					bytes.length,
				);
				const stream = await driver.getStream({ key });
				const hash = createHash('sha256');

				for await (const chunk of stream as AsyncIterable<
					Uint8Array | string
				>) {
					hash.update(chunk);
				}

				expect(hash.digest('hex')).toBe(
					createHash('sha256').update(bytes).digest('hex'),
				);
			},
		);

		liveTest(
			'aborts failed stream uploads without publishing partial objects',
			async () => {
				const key = `${prefix}/aborted/data.bin`;
				const before = abortedUploads;
				const contents = Readable.from(
					(async function* () {
						yield Buffer.from('partial');
						throw new Error('Integration source failure');
					})(),
				);
				await expect(
					driver.putStream({ key, contents }),
				).rejects.toBeInstanceOf(StorageOperationError);
				expect(abortedUploads - before).toBe(1);
				expect(await driver.exists({ key })).toBe(false);
			},
		);

		liveTest(
			'copies and moves with overwrites and self-transfer handling',
			async () => {
				const source = `${prefix}/transfers/source 世界.txt`;
				const destination = `${prefix}/transfers/destination.txt`;
				await driver.put({
					key: source,
					contents: 'source',
					contentType: 'text/plain',
				});
				await driver.put({ key: destination, contents: 'old destination' });
				await driver.copy({ source, destination });
				expect(await driver.get({ key: source })).toBe('source');
				expect(await driver.get({ key: destination })).toBe('source');
				await driver.move({ source, destination });
				expect(await driver.exists({ key: source })).toBe(false);
				await driver.copy({ source: destination, destination });
				await driver.move({ source: destination, destination });
				expect(await driver.get({ key: destination })).toBe('source');
			},
		);

		liveTest('imports and moves filesystem files', async () => {
			const directory = await mkdtemp(
				join(tmpdir(), 'lagomkit-storage-integration-'),
			);
			const source = join(directory, 'source.txt');

			try {
				await writeFile(source, 'filesystem');
				await driver.copyFromFs({
					source: pathToFileURL(source),
					destination: `${prefix}/filesystem/copy.txt`,
				});
				expect(await readFile(source, 'utf8')).toBe('filesystem');
				await driver.moveFromFs({
					source,
					destination: `${prefix}/filesystem/move.txt`,
				});
				expect(await driver.get({ key: `${prefix}/filesystem/move.txt` })).toBe(
					'filesystem',
				);
				await expect(readFile(source)).rejects.toMatchObject({
					code: 'ENOENT',
				});
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		});

		liveTest(
			'paginates listings and deletes only the requested directory prefix',
			async () => {
				const directory = `${prefix}/listing`;
				const keys = [
					`${directory}/a.txt`,
					`${directory}/nested/b.txt`,
					`${directory}/c.txt`,
				];

				for (const key of [...keys, `${directory}-backup/keep.txt`]) {
					await driver.put({ key, contents: 'listed' });
				}

				const direct = await driver.listAll({ prefix: directory });
				expect(direct.objects).toHaveLength(3);
				expect(direct.objects).toContainEqual({
					isFile: false,
					isDirectory: true,
					prefix: `${directory}/nested/`,
				});
				const found: string[] = [];
				let paginationToken: string | undefined;
				let pages = 0;

				do {
					const page = await driver.listAll({
						prefix: directory,
						recursive: true,
						maxResults: 1,
						...(paginationToken ? { paginationToken } : {}),
					});
					found.push(
						...page.objects.flatMap((entry) =>
							entry.isFile ? [entry.key] : [],
						),
					);
					paginationToken = page.paginationToken;
					pages += 1;
					expect(pages).toBeLessThanOrEqual(5);
				} while (paginationToken);

				expect(found.sort()).toEqual(keys.sort());
				expect(pages).toBeGreaterThan(1);
				await driver.deleteAll({ prefix: directory });
				expect(
					(await driver.listAll({ prefix: directory, recursive: true }))
						.objects,
				).toEqual([]);
				expect(
					await driver.exists({ key: `${directory}-backup/keep.txt` }),
				).toBe(true);
			},
		);

		liveTest('uploads and downloads through actual signed URLs', async () => {
			const key = `${prefix}/signed/space 世界 #?%.bin`;
			const bytes = new Uint8Array([0, 255, 128, 13]);
			const upload = await driver.getSignedUploadUrl({
				key,
				contentType: 'application/octet-stream',
				expiresIn: 60,
			});
			const uploaded = await fetch(upload.url, {
				method: upload.method,
				headers: upload.headers,
				body: bytes,
				signal: AbortSignal.timeout(30_000),
			});
			await uploaded.body?.cancel();
			expect(uploaded.status, 'Signed upload status').toBe(200);
			expect([...(await driver.getBytes({ key }))]).toEqual([...bytes]);
			const url = await driver.getSignedUrl({
				key,
				expiresIn: 60,
				contentDisposition: 'attachment; filename="integration.bin"',
			});
			const downloaded = await fetch(url, {
				signal: AbortSignal.timeout(30_000),
			});

			try {
				expect(downloaded.status, 'Signed download status').toBe(200);
				expect(downloaded.headers.get('content-disposition')).toBe(
					'attachment; filename="integration.bin"',
				);
				expect([...new Uint8Array(await downloaded.arrayBuffer())]).toEqual([
					...bytes,
				]);
			} finally {
				if (!downloaded.bodyUsed) {
					await downloaded.body?.cancel();
				}
			}
		});

		liveTest('reports missing files and deletes idempotently', async () => {
			const key = `${prefix}/missing`;
			expect(await driver.exists({ key })).toBe(false);
			await expect(driver.get({ key })).rejects.toBeInstanceOf(
				StorageNotFoundError,
			);
			await expect(driver.getMetaData({ key })).rejects.toBeInstanceOf(
				StorageNotFoundError,
			);
			await driver.delete({ key });
			await driver.put({ key, contents: 'deleted' });
			await driver.delete({ key });
			await driver.delete({ key });
			expect(await driver.exists({ key })).toBe(false);
		});
	},
);
