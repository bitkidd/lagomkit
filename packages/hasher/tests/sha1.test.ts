import { describe, expect, test } from 'vitest';

import { createSha1Driver } from '#src/drivers/sha1.js';

describe('Hasher::SHA1', () => {
	const driver = createSha1Driver();

	test('should hash with expected digest length', async () => {
		const hash = await driver.hash({ content: 'hello world' });

		expect(hash).toBeDefined();
		expect(hash.length).toBe(40);
	});

	test('should verify hash', async () => {
		const hash = await driver.hash({ content: 'hello world' });
		const isVerified = await driver.verify({ content: 'hello world', hash });

		expect(isVerified).toBeTruthy();
	});
});
