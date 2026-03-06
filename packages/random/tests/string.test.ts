import { describe, expect, test } from 'vitest';
import { createRandomStringDriver } from '#src/drivers/string.js';

describe('Random::String', () => {
	const driver = createRandomStringDriver();

	test('should return a driver instance', () => {
		expect(driver).toHaveProperty('generate');
	});

	test('should generate random string', async () => {
		const random = driver.generate();

		expect(random).toBeDefined();
	});

	test('should generate random string of 6 chars by default', async () => {
		const random = driver.generate();

		expect(random.length).toBe(16);
	});

	test('should generate random string of 12 chars', async () => {
		const random = driver.generate({ length: 12 });

		expect(random.length).toBe(12);
	});

	test('should throw on invalid length', () => {
		expect(() => driver.generate({ length: 0 })).toThrowError(
			'Random string length must be a positive integer',
		);
	});
});
