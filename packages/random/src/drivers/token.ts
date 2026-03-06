import type { RandomGeneratorDriverContract } from '#src/types.js';

/**
 * Runtime options for numeric token generation.
 */
export type RandomTokenDriverOptions = {
	length?: number;
};

function ensureValidLength(length: number): void {
	if (!Number.isInteger(length) || length <= 0) {
		throw new Error('Random token length must be a positive integer');
	}
}

/**
 * Creates a numeric token random driver.
 *
 * @param config.length Default output length.
 */
export function createRandomTokenDriver(config?: {
	length?: number;
}): RandomGeneratorDriverContract<RandomTokenDriverOptions> {
	const defaultLength = config?.length ?? 6;
	ensureValidLength(defaultLength);

	return {
		generate: (options?: RandomTokenDriverOptions): string => {
			const length = options?.length ?? defaultLength;
			ensureValidLength(length);

			const digits = '0123456789';
			const randomValues = new Uint32Array(length);
			globalThis.crypto.getRandomValues(randomValues);

			let result = '';

			for (let index = 0; index < length; index++) {
				const randomValue = randomValues[index] ?? 0;
				result += digits.charAt(randomValue % digits.length);
			}

			return result;
		},
	};
}
