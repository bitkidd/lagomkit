import { describe, expect, test } from 'vitest';
import { createBcryptDriver } from '#src/drivers/bcrypt.js';

describe('Hasher::Bcrypt', () => {
	const driver = createBcryptDriver();

	test('should return a driver instance', () => {
		expect(driver).toHaveProperty('hash');
		expect(driver).toHaveProperty('verify');
	});

	test('should return a hash', async () => {
		const hash = await driver.hash({ content: 'hello world' });

		expect(hash).toMatch(/^\$2[aby]\$10\$/);
	});

	test('should verify a hash', async () => {
		const hash = await driver.hash({ content: 'hello world' });
		const isVerified = await driver.verify({ content: 'hello world', hash });

		expect(isVerified).toBeTruthy();
	});

	test('should preserve the configured cost and normalize passwords', async () => {
		const customDriver = createBcryptDriver({ cost: 4 });
		const hash = await customDriver.hash({ content: 'ｈｅｌｌｏ' });

		expect(hash).toMatch(/^\$2[aby]\$04\$/);
		await expect(customDriver.verify({ content: 'hello', hash })).resolves.toBe(
			true,
		);
	});

	test('should verify hashes created by bcrypt 1.x', async () => {
		const hash = '$2y$04$zPKcOhB.9DK8Ccy3Vlrj9.K.ywJx80A5UCz.XJFU0XD9YHxwIt6xa';

		await expect(driver.verify({ content: 'hello world', hash })).resolves.toBe(
			true,
		);
		await expect(
			driver.verify({ content: 'wrong password', hash }),
		).resolves.toBe(false);
	});
});
