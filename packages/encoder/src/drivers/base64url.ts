import type { EncoderDriver } from '#src/types.js';

import { createBase64Driver } from './base64.js';

/**
 * Creates a URL-safe Base64 encoder/decoder driver.
 */
export function createBase64UrlDriver(): EncoderDriver {
	const base64 = createBase64Driver();

	return {
		encode({
			data,
			options,
		}: {
			data: Uint8Array;
			options?: { includePadding?: boolean };
		}): string {
			const includePadding = options?.includePadding ?? false;
			let encoded = base64
				.encode({ data, options: { includePadding: true } })
				.replace(/\+/g, '-')
				.replace(/\//g, '_');

			if (!includePadding) {
				encoded = encoded.replace(/=+$/, '');
			}

			return encoded;
		},

		decode({ data }: { data: string }): Uint8Array {
			const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
			const padCount = (4 - (normalized.length % 4)) % 4;

			return base64.decode({ data: normalized + '='.repeat(padCount) });
		},
	};
}
