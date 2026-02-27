import { describe, expect, test } from 'vitest';
import { createArgon2Driver } from '../src/drivers/argon2.js';

describe('Hasher::Argon2', () => {
	const driver = createArgon2Driver();

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
