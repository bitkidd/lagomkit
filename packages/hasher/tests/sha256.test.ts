import { describe, expect, test } from 'vitest';
import { createSha256Driver } from '#src/drivers/sha256.js';

describe('Hasher::SHA256', () => {
	const driver = createSha256Driver();

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
