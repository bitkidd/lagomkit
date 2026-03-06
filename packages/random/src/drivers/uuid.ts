import type { RandomGeneratorDriverContract } from '#src/types.js';

/**
 * Creates a UUID v4 random driver.
 */
export function createRandomUuidDriver(): RandomGeneratorDriverContract {
	return {
		generate: (): string => {
			return globalThis.crypto.randomUUID();
		},
	};
}
