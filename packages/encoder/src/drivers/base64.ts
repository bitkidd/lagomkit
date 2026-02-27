import type { EncoderDriver } from '#src/types.js';

export function createBase64Driver(): EncoderDriver {
	const alphabet =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

	return {
		encode({
			data,
			options,
		}: {
			data: Uint8Array;
			options?: { includePadding?: boolean };
		}): string {
			let result = '';
			let buffer = 0;
			let shift = 0;

			for (const byte of data) {
				buffer = (buffer << 8) | byte;
				shift += 8;

				while (shift >= 6) {
					shift -= 6;
					result += alphabet[(buffer >> shift) & 0x3f];
				}
			}

			if (shift > 0) {
				result += alphabet[(buffer << (6 - shift)) & 0x3f];
			}

			const includePadding = options?.includePadding ?? true;
			if (includePadding) {
				const padCount = (4 - (result.length % 4)) % 4;
				result += '='.repeat(padCount);
			}

			return result;
		},

		decode({ data }: { data: string }): Uint8Array {
			const cleanBase64 = data.replace(/=+$/, '');
			const outputLength = Math.floor((cleanBase64.length * 3) / 4);
			const result = new Uint8Array(outputLength);

			let buffer = 0;
			let bits = 0;
			let index = 0;

			for (let i = 0; i < cleanBase64.length; i++) {
				const value = alphabet.indexOf(cleanBase64.charAt(i));
				if (value === -1) throw new Error('Invalid character in Base64 string');

				buffer = (buffer << 6) | value;
				bits += 6;

				if (bits >= 8) {
					bits -= 8;
					result[index++] = (buffer >> bits) & 0xff;
				}
			}

			return result;
		},
	};
}
