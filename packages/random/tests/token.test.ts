import { describe, expect, test } from 'vitest';
import { createRandomTokenDriver } from '#src/drivers/token.js';

describe('Random::Token', () => {
	const driver = createRandomTokenDriver();

	test('should return a driver instance', () => {
		expect(driver).toHaveProperty('generate');
	});

	test('should generate random token', async () => {
		const random = driver.generate();

		expect(random).toBeDefined();
	});

	test('should generate random token of 6 chars by default', async () => {
		const random = driver.generate();

		expect(random.length).toBe(6);
	});

	test('should generate random token of 12 chars', async () => {
		const random = driver.generate({ length: 12 });

		expect(random.length).toBe(12);
	});

	test('should generate numeric-only token', () => {
		const token = driver.generate({ length: 24 });

		expect(token).toMatch(/^\d+$/);
	});

	test('should throw on invalid length', () => {
		expect(() => driver.generate({ length: -1 })).toThrowError(
			'Random token length must be a positive integer',
		);
	});
});
