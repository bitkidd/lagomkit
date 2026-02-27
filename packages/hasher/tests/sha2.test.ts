import { describe, expect, test } from 'vitest';

import {
	createSha2_224Driver,
	createSha2_256Driver,
	createSha2_384Driver,
	createSha2_512Driver,
} from '#src/drivers/sha2.js';

describe('Hasher::SHA2', () => {
	test('should hash with expected digest lengths', async () => {
		const hash224 = await createSha2_224Driver().hash({
			content: 'hello world',
		});
		const hash256 = await createSha2_256Driver().hash({
			content: 'hello world',
		});
		const hash384 = await createSha2_384Driver().hash({
			content: 'hello world',
		});
		const hash512 = await createSha2_512Driver().hash({
			content: 'hello world',
		});

		expect(hash224.length).toBe(56);
		expect(hash256.length).toBe(64);
		expect(hash384.length).toBe(96);
		expect(hash512.length).toBe(128);
	});

	test('should verify hash', async () => {
		const driver = createSha2_512Driver();
		const hash = await driver.hash({ content: 'hello world' });
		const isVerified = await driver.verify({ content: 'hello world', hash });

		expect(isVerified).toBeTruthy();
	});
});
