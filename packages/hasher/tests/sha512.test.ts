import { describe, expect, test } from 'vitest';
import { createSha512Driver } from '#src/drivers/sha512.js';

describe('Hasher::SHA512', () => {
	const driver = createSha512Driver();

	test('should return a driver instance', () => {
		expect(driver).toHaveProperty('hash');
		expect(driver).toHaveProperty('verify');
	});

	test('should return a hash', async () => {
		const hash = await driver.hash({ content: 'hello world' });

		expect(hash).toBeDefined();
	});

	test('should verify a hash', async () => {
		const hash = await driver.hash({ content: 'hello world' });
		const isVerified = await driver.verify({ content: 'hello world', hash });

		expect(isVerified).toBeTruthy();
	});
});
