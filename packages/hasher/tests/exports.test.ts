import { describe, expect, test } from 'vitest';

import * as hasher from '#src/exports.js';

describe('Hasher::Exports', () => {
	test('should export expected factories from package entrypoint', () => {
		const exportedFactories = [
			'createHasherService',
			'createArgon2Driver',
			'createBcryptDriver',
			'createSha1Driver',
			'createSha2_224Driver',
			'createSha2_256Driver',
			'createSha2_384Driver',
			'createSha2_512Driver',
			'createSha3_224Driver',
			'createSha3_256Driver',
			'createSha3_384Driver',
			'createSha3_512Driver',
			'createSha256Driver',
			'createSha512Driver',
		] as const;

		for (const name of exportedFactories) {
			expect(hasher).toHaveProperty(name);
			expect(hasher[name]).toEqual(expect.any(Function));
		}
	});
});
