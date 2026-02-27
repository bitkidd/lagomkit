import { describe, expect, test } from 'vitest';

import {
	createSha3_224Driver,
	createSha3_256Driver,
	createSha3_384Driver,
	createSha3_512Driver,
} from '../src/drivers/sha3.js';

describe('Hasher::SHA3', () => {
	test('should hash with expected digest lengths', async () => {
		const hash224 = await createSha3_224Driver().hash({
			content: 'hello world',
		});
		const hash256 = await createSha3_256Driver().hash({
			content: 'hello world',
		});
		const hash384 = await createSha3_384Driver().hash({
			content: 'hello world',
		});
		const hash512 = await createSha3_512Driver().hash({
			content: 'hello world',
		});

		expect(hash224.length).toBe(56);
		expect(hash256.length).toBe(64);
		expect(hash384.length).toBe(96);
		expect(hash512.length).toBe(128);
	});

	test('should verify hash', async () => {
		const driver = createSha3_512Driver();
		const hash = await driver.hash({ content: 'hello world' });
		const isVerified = await driver.verify({ content: 'hello world', hash });

		expect(isVerified).toBeTruthy();
	});
});
