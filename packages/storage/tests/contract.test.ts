import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { StorageInvalidKeyError, StorageNotFoundError } from '#src/exports.js';
import { createHarness } from './_helpers.js';

describe.each(['local', 's3'] as const)(
	'Storage::%s::Contract',
	{ concurrent: false },
	(kind) => {
		let harness: Awaited<ReturnType<typeof createHarness>>;

		beforeEach(async () => {
			harness = await createHarness(kind);
		});

		afterEach(async () => {
			await harness.close();
		});

		test('should expose the same complete driver contract', () => {
			expect(Object.keys(harness.driver).sort()).toEqual(
				[
					'put',
					'putStream',
					'get',
					'getBytes',
					'getStream',
					'getMetaData',
					'exists',
					'delete',
					'deleteAll',
					'copy',
					'move',
					'copyFromFs',
					'moveFromFs',
					'listAll',
					'getUrl',
					'getSignedUrl',
					'getSignedUploadUrl',
				].sort(),
			);
		});

		test('should round-trip UTF-8 text, binary, empty files, and overwrites', async () => {
			const { driver } = harness;
			await driver.put({ key: 'nested/hello.txt', contents: 'Hello, 世界' });
			expect(await driver.get({ key: 'nested/hello.txt' })).toBe('Hello, 世界');
			await driver.put({ key: 'nested/hello.txt', contents: 'Replaced' });
			expect(await driver.get({ key: 'nested/hello.txt' })).toBe('Replaced');

			const bytes = new Uint8Array([0, 255, 13, 128]);
			await driver.put({ key: 'bytes.bin', contents: bytes });
			expect(Array.from(await driver.getBytes({ key: 'bytes.bin' }))).toEqual([
				...bytes,
			]);
			await driver.put({ key: 'empty.bin', contents: new Uint8Array() });
			expect(await driver.getBytes({ key: 'empty.bin' })).toHaveLength(0);
			await driver.putStream({
				key: 'empty-stream.bin',
				contents: Readable.from(['', new Uint8Array()]),
			});
			expect(await driver.getBytes({ key: 'empty-stream.bin' })).toHaveLength(
				0,
			);
		});

		test('should upload and download streams', async () => {
			await harness.driver.putStream({
				key: 'stream.txt',
				contents: Readable.from(['Hello ', 'world']),
			});
			const stream = await harness.driver.getStream({ key: 'stream.txt' });

			expect(Buffer.concat(await stream.toArray()).toString()).toBe(
				'Hello world',
			);
		});

		test('should report missing files consistently and delete idempotently', async () => {
			const { driver } = harness;
			expect(await driver.exists({ key: 'missing.txt' })).toBe(false);
			await expect(driver.get({ key: 'missing.txt' })).rejects.toBeInstanceOf(
				StorageNotFoundError,
			);
			await expect(
				driver.getBytes({ key: 'missing.txt' }),
			).rejects.toBeInstanceOf(StorageNotFoundError);
			await expect(
				driver.getStream({ key: 'missing.txt' }),
			).rejects.toBeInstanceOf(StorageNotFoundError);
			await expect(
				driver.getMetaData({ key: 'missing.txt' }),
			).rejects.toBeInstanceOf(StorageNotFoundError);
			await driver.delete({ key: 'missing.txt' });
			await driver.put({ key: 'file.txt', contents: 'Hello' });
			expect(await driver.exists({ key: 'file.txt' })).toBe(true);
			await driver.delete({ key: 'file.txt' });
			await driver.delete({ key: 'file.txt' });
			expect(await driver.exists({ key: 'file.txt' })).toBe(false);
		});

		test('should expose size, content type, modification date, and etag', async () => {
			await harness.driver.put({
				key: 'hello.txt',
				contents: '世界',
				contentType: 'text/plain',
			});

			expect(
				await harness.driver.getMetaData({ key: 'hello.txt' }),
			).toMatchObject({
				contentLength: 6,
				contentType: 'text/plain',
				etag: expect.any(String),
				lastModified: expect.any(Date),
			});
		});

		test('should copy and move with overwrites while preserving missing-file errors', async () => {
			const { driver } = harness;
			await driver.put({ key: 'original.txt', contents: 'Original' });
			await driver.put({ key: 'nested/copy.txt', contents: 'Old value' });
			await driver.copy({
				source: 'original.txt',
				destination: 'nested/copy.txt',
			});
			expect(await driver.get({ key: 'original.txt' })).toBe('Original');
			expect(await driver.get({ key: 'nested/copy.txt' })).toBe('Original');
			await driver.move({
				source: 'original.txt',
				destination: 'nested/copy.txt',
			});
			expect(await driver.exists({ key: 'original.txt' })).toBe(false);
			expect(await driver.get({ key: 'nested/copy.txt' })).toBe('Original');
			await driver.copy({
				source: 'nested/copy.txt',
				destination: 'nested/copy.txt',
			});
			await driver.move({
				source: 'nested/copy.txt',
				destination: 'nested/copy.txt',
			});
			expect(await driver.get({ key: 'nested/copy.txt' })).toBe('Original');
			await expect(
				driver.copy({ source: 'missing', destination: 'target' }),
			).rejects.toBeInstanceOf(StorageNotFoundError);
			await expect(
				driver.move({ source: 'missing', destination: 'target' }),
			).rejects.toBeInstanceOf(StorageNotFoundError);
		});

		test('should copy and move from absolute filesystem paths and file URLs', async () => {
			const source = join(harness.directory, 'source.txt');
			await writeFile(source, 'From filesystem');
			await harness.driver.copyFromFs({
				source: pathToFileURL(source),
				destination: 'copied.txt',
			});
			expect(await readFile(source, 'utf8')).toBe('From filesystem');
			await harness.driver.moveFromFs({ source, destination: 'moved.txt' });
			expect(await harness.driver.get({ key: 'moved.txt' })).toBe(
				'From filesystem',
			);
			await expect(readFile(source)).rejects.toMatchObject({ code: 'ENOENT' });
		});

		test('should retain filesystem sources when the destination is invalid', async () => {
			const source = join(harness.directory, 'source.txt');
			await writeFile(source, 'Keep me');

			await expect(
				harness.driver.moveFromFs({ source, destination: '../outside.txt' }),
			).rejects.toBeInstanceOf(StorageInvalidKeyError);
			expect(await readFile(source, 'utf8')).toBe('Keep me');
			await expect(
				harness.driver.copyFromFs({
					source: 'relative.txt',
					destination: 'target.txt',
				}),
			).rejects.toThrow('absolute path');
		});

		test('should list directories and recursively list files inside a prefix', async () => {
			const { driver } = harness;
			await driver.put({ key: 'photos/a.txt', contents: 'a' });
			await driver.put({ key: 'photos/nested/b.txt', contents: 'b' });
			await driver.put({ key: 'photos-backup/c.txt', contents: 'c' });
			const page = await driver.listAll({ prefix: 'photos' });

			expect(page.objects).toEqual(
				expect.arrayContaining([
					{ isFile: true, isDirectory: false, key: 'photos/a.txt' },
					{ isFile: false, isDirectory: true, prefix: 'photos/nested/' },
				]),
			);
			expect(page.objects).toHaveLength(2);
			expect(
				(await driver.listAll({ prefix: 'photos', recursive: true })).objects,
			).toEqual([
				{ isFile: true, isDirectory: false, key: 'photos/a.txt' },
				{ isFile: true, isDirectory: false, key: 'photos/nested/b.txt' },
			]);
			expect((await driver.listAll({ prefix: 'absent' })).objects).toEqual([]);
		});

		test('should delete a directory prefix without deleting similarly named files', async () => {
			const { driver } = harness;
			await driver.put({ key: 'photos/a.txt', contents: 'a' });
			await driver.put({ key: 'photos/nested/b.txt', contents: 'b' });
			await driver.put({ key: 'photos-backup/c.txt', contents: 'c' });
			await driver.deleteAll({ prefix: 'photos' });

			expect(await driver.exists({ key: 'photos/a.txt' })).toBe(false);
			expect(await driver.exists({ key: 'photos/nested/b.txt' })).toBe(false);
			expect(await driver.exists({ key: 'photos-backup/c.txt' })).toBe(true);
			await expect(driver.deleteAll({ prefix: '' })).rejects.toBeInstanceOf(
				StorageInvalidKeyError,
			);
			await expect(
				// @ts-expect-error JavaScript callers must explicitly request the root
				driver.deleteAll({}),
			).rejects.toBeInstanceOf(StorageInvalidKeyError);
			await driver.deleteAll({ prefix: '/' });
			expect((await driver.listAll({ recursive: true })).objects).toEqual([]);
		});

		test.each([
			'',
			' ',
			'../outside',
			'a/../../outside',
			'/absolute',
			'C:/file',
			'a\\b',
			'a//b',
			'a/./b',
			'file\0.txt',
			'.lagomkit-upload-internal',
		])('should reject unsafe key %j before touching storage', async (key) => {
			await expect(
				harness.driver.put({ key, contents: 'bad' }),
			).rejects.toBeInstanceOf(StorageInvalidKeyError);
			await expect(harness.driver.getBytes({ key })).rejects.toBeInstanceOf(
				StorageInvalidKeyError,
			);
			await expect(harness.driver.delete({ key })).rejects.toBeInstanceOf(
				StorageInvalidKeyError,
			);
			await expect(
				harness.driver.copy({ source: 'source', destination: key }),
			).rejects.toBeInstanceOf(StorageInvalidKeyError);
		});

		test('should encode URL segments without leaking fragments or query parameters', async () => {
			expect(await harness.driver.getUrl({ key: 'dir/a b#?%.txt' })).toBe(
				'https://cdn.example.test/assets/dir/a%20b%23%3F%25.txt',
			);
		});
	},
);
