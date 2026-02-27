import { describe, expect, test } from 'vitest';
import { createBcryptDriver } from '../src/drivers/bcrypt.js';

describe('Hasher::Bcrypt', () => {
	const driver = createBcryptDriver();

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
