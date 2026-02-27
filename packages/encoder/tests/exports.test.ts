import { describe, expect, test } from 'vitest';

import * as encoder from '#src/exports.js';

describe('Encoder::Exports', () => {
	test('should export expected factories from package entrypoint', () => {
		const exportedFactories = [
			'createEncoderService',
			'createBase32Driver',
			'createBase64Driver',
			'createBase64UrlDriver',
			'createHexDriver',
		] as const;

		for (const name of exportedFactories) {
			expect(encoder).toHaveProperty(name);
			expect(encoder[name]).toEqual(expect.any(Function));
		}
	});
});
