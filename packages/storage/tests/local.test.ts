import { mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
	createLocalStorageDriver,
	StorageInvalidKeyError,
	StorageNotFoundError,
	StorageOperationError,
	StorageUnsupportedOperationError,
} from '#src/exports.js';
import { createHarness } from './_helpers.js';

describe('Storage::Local', { concurrent: false }, () => {
	let harness: Awaited<ReturnType<typeof createHarness>>;

	beforeEach(async () => {
		harness = await createHarness('local');
	});

	afterEach(async () => {
		await harness.close();
	});

	test('rejects symlink files and directories without touching their targets', async () => {
		const { driver, directory, root } = harness;
		const outside = join(directory, 'outside');
		await mkdir(outside);
		await writeFile(join(outside, 'secret.txt'), 'secret');
		await driver.put({ key: 'source.txt', contents: 'source' });
		await symlink(outside, join(root, 'linked-directory'));
		await symlink(join(outside, 'secret.txt'), join(root, 'linked-file'));

		for (const key of ['linked-directory/secret.txt', 'linked-file']) {
			await expect(driver.get({ key })).rejects.toBeInstanceOf(
				StorageInvalidKeyError,
			);
			await expect(driver.exists({ key })).rejects.toBeInstanceOf(
				StorageInvalidKeyError,
			);
			await expect(
				driver.put({ key, contents: 'changed' }),
			).rejects.toBeInstanceOf(StorageInvalidKeyError);
			await expect(driver.delete({ key })).rejects.toBeInstanceOf(
				StorageInvalidKeyError,
			);
			await expect(
				driver.copy({ source: 'source.txt', destination: key }),
			).rejects.toBeInstanceOf(StorageInvalidKeyError);
			await expect(
				driver.move({ source: 'source.txt', destination: key }),
			).rejects.toBeInstanceOf(StorageInvalidKeyError);
		}

		await expect(
			driver.listAll({ prefix: 'linked-directory' }),
		).rejects.toBeInstanceOf(StorageInvalidKeyError);
		expect((await driver.listAll({ recursive: true })).objects).toEqual([
			{ isFile: true, isDirectory: false, key: 'source.txt' },
		]);
		expect(await readFile(join(outside, 'secret.txt'), 'utf8')).toBe('secret');
		expect(await driver.get({ key: 'source.txt' })).toBe('source');
	});

	test('failed streams preserve existing files and remove temporary uploads', async () => {
		const { driver, root } = harness;
		await driver.put({ key: 'file.txt', contents: 'original' });
		const failure = new Error('source failed');
		const contents = Readable.from(
			(async function* () {
				yield Buffer.from('partial');
				throw failure;
			})(),
		);

		await expect(
			driver.putStream({ key: 'file.txt', contents }),
		).rejects.toMatchObject({
			cause: failure,
		});
		expect(contents.destroyed).toBe(true);
		expect(await driver.get({ key: 'file.txt' })).toBe('original');
		expect(await readdir(root)).toEqual(['file.txt']);
	});

	test('moving a filesystem file onto itself retains the file', async () => {
		const { driver, root } = harness;
		await driver.put({ key: 'file.txt', contents: 'original' });
		await driver.moveFromFs({
			source: join(root, 'file.txt'),
			destination: 'file.txt',
		});
		expect(await driver.get({ key: 'file.txt' })).toBe('original');
	});

	test('directories are not readable objects and cannot be deleted as files', async () => {
		const { driver } = harness;
		await driver.put({ key: 'directory/file', contents: 'kept' });
		await expect(driver.get({ key: 'directory' })).rejects.toBeInstanceOf(
			StorageNotFoundError,
		);
		await expect(
			driver.getMetaData({ key: 'directory' }),
		).rejects.toBeInstanceOf(StorageNotFoundError);
		expect(await driver.exists({ key: 'directory' })).toBe(false);
		await expect(driver.delete({ key: 'directory' })).rejects.toBeInstanceOf(
			StorageOperationError,
		);
		expect(await driver.get({ key: 'directory/file' })).toBe('kept');
	});

	test('rejects unsupported operations', async () => {
		const driver = createLocalStorageDriver({
			root: harness.root,
		});

		for (const operation of [
			driver.getUrl({ key: 'file' }),
			driver.getSignedUrl({ key: 'file' }),
			driver.getSignedUploadUrl({ key: 'file' }),
			driver.listAll({ maxResults: 1 }),
			driver.listAll({ paginationToken: 'next' }),
		]) {
			await expect(operation).rejects.toBeInstanceOf(
				StorageUnsupportedOperationError,
			);
		}
	});

	test('infers MIME types from names and validates configuration', async () => {
		await harness.driver.put({
			key: 'file.json',
			contents: '{}',
			contentType: 'text/plain',
		});
		expect(
			(await harness.driver.getMetaData({ key: 'file.json' })).contentType,
		).toBe('application/json');
		expect(() => createLocalStorageDriver({ root: ' ' })).toThrow(TypeError);

		for (const baseUrl of [
			'',
			'file:///tmp',
			'https://user:pass@host',
			'https://host/?token=x',
			'https://host/#fragment',
		]) {
			expect(() =>
				createLocalStorageDriver({ root: harness.root, baseUrl }),
			).toThrow(TypeError);
		}
	});
});
