import type { EncoderDriver } from '#src/types.js';

export function createBase32Driver(): EncoderDriver {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

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

				while (shift >= 5) {
					shift -= 5;
					result += alphabet[(buffer >> shift) & 0x1f];
				}
			}

			if (shift > 0) {
				result += alphabet[(buffer << (5 - shift)) & 0x1f];
			}

			const includePadding = options?.includePadding ?? true;
			if (includePadding) {
				const padCount = (8 - (result.length % 8)) % 8;
				result += '='.repeat(padCount);
			}

			return result;
		},

		decode({ data }: { data: string }): Uint8Array {
			const cleanBase32 = data.replace(/=+$/, '');
			const outputLength = Math.floor((cleanBase32.length * 5) / 8);
			const result = new Uint8Array(outputLength);

			let buffer = 0;
			let bits = 0;
			let index = 0;

			for (let i = 0; i < cleanBase32.length; i++) {
				const value = alphabet.indexOf(cleanBase32.charAt(i));
				if (value === -1) throw new Error('Invalid character in Base32 string');

				buffer = (buffer << 5) | value;
				bits += 5;

				if (bits >= 8) {
					bits -= 8;
					result[index++] = (buffer >> bits) & 0xff;
				}
			}

			return result;
		},
	};
}
