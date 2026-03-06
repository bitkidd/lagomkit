import type { RandomGeneratorDriverContract } from '#src/types.js';

export type RandomStringDriverOptions = {
	length?: number;
};

function ensureValidLength(length: number): void {
	if (!Number.isInteger(length) || length <= 0) {
		throw new Error('Random string length must be a positive integer');
	}
}

export function createRandomStringDriver(config?: {
	length?: number;
}): RandomGeneratorDriverContract<RandomStringDriverOptions> {
	const defaultLength = config?.length ?? 16;
	ensureValidLength(defaultLength);

	return {
		generate: (options?: RandomStringDriverOptions): string => {
			const length = options?.length ?? defaultLength;
			ensureValidLength(length);

			const array = new Uint8Array(Math.ceil(length / 2));
			globalThis.crypto.getRandomValues(array);
			const randomHex = Array.from(array)
				.map((byte) => byte.toString(16).padStart(2, '0'))
				.join('');

			return randomHex.slice(0, length);
		},
	};
}
