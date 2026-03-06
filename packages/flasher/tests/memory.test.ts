import { describe, expect, test } from 'vitest';
import { createMemoryFlasherDriver } from '../src/exports.js';

describe('Flasher::Memory', () => {
	test('set should return id and get should consume value', async () => {
		const driver = createMemoryFlasherDriver();
		const id = await driver.set({ kind: 'success', text: 'Saved' });

		expect(typeof id).toBe('string');
		expect(await driver.get<{ kind: string; text: string }>(id)).toEqual({
			kind: 'success',
			text: 'Saved',
		});
		expect(await driver.get(id)).toBeUndefined();
	});

	test('peek should not consume value', async () => {
		const driver = createMemoryFlasherDriver();
		const id = await driver.set('hello');

		expect(await driver.peek<string>(id)).toBe('hello');
		expect(await driver.peek<string>(id)).toBe('hello');
		expect(await driver.get<string>(id)).toBe('hello');
		expect(await driver.get(id)).toBeUndefined();
	});

	test('getMany should consume and include only found ids', async () => {
		const driver = createMemoryFlasherDriver();
		const firstId = await driver.set('first');
		const secondId = await driver.set('second');

		const values = await driver.getMany<string>([
			firstId,
			'missing-id',
			firstId,
			secondId,
		]);

		expect(values).toEqual({
			[firstId]: 'first',
			[secondId]: 'second',
		});

		expect(await driver.get(firstId)).toBeUndefined();
		expect(await driver.get(secondId)).toBeUndefined();
	});

	test('peekMany should not consume and include only found ids', async () => {
		const driver = createMemoryFlasherDriver();
		const firstId = await driver.set('first');
		const secondId = await driver.set('second');

		const values = await driver.peekMany<string>([
			firstId,
			'missing-id',
			secondId,
		]);

		expect(values).toEqual({
			[firstId]: 'first',
			[secondId]: 'second',
		});

		expect(await driver.get(firstId)).toBe('first');
		expect(await driver.get(secondId)).toBe('second');
	});

	test('erase and clear should delete values', async () => {
		const driver = createMemoryFlasherDriver();
		const idOne = await driver.set(1);
		const idTwo = await driver.set(2);

		await driver.erase(idOne);
		expect(await driver.get(idOne)).toBeUndefined();

		await driver.clear();
		expect(await driver.get(idTwo)).toBeUndefined();
	});

	test('ttl should expire values', async () => {
		const driver = createMemoryFlasherDriver();
		const id = await driver.set('short-lived', { ttlMs: 5 });

		await new Promise((resolve) => setTimeout(resolve, 15));

		expect(await driver.peek(id)).toBeUndefined();
		expect(await driver.get(id)).toBeUndefined();
	});
});
