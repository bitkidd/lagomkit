import type { EncoderDriver } from '#src/types.js';

export function createHexDriver(): EncoderDriver {
	const hexDecodeMap = new Map<string, number>([
		['0', 0],
		['1', 1],
		['2', 2],
		['3', 3],
		['4', 4],
		['5', 5],
		['6', 6],
		['7', 7],
		['8', 8],
		['9', 9],
		['A', 10],
		['B', 11],
		['C', 12],
		['D', 13],
		['E', 14],
		['F', 15],
		['a', 10],
		['b', 11],
		['c', 12],
		['d', 13],
		['e', 14],
		['f', 15],
	]);

	return {
		encode({ data }: { data: Uint8Array }): string {
			return Array.from(data)
				.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
				.join('');
		},

		decode({ data }: { data: string }): Uint8Array {
			if (data.length % 2 !== 0) {
				throw new Error('Invalid data length');
			}

			const result = new Uint8Array(data.length / 2);

			for (let i = 0; i < result.length; i++) {
				const hexPair = data.slice(i * 2, i * 2 + 2);
				const highNibble = hexDecodeMap.get(hexPair.charAt(0));
				const lowNibble = hexDecodeMap.get(hexPair.charAt(1));

				if (highNibble == null || lowNibble == null) {
					throw new Error(`Invalid character in input: ${hexPair}`);
				}

				result[i] = (highNibble << 4) | lowNibble;
			}

			return result;
		},
	};
}
