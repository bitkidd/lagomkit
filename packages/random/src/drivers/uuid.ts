import type { RandomGeneratorDriverContract } from '#src/types.js';

export function createRandomUuidDriver(): RandomGeneratorDriverContract {
	return {
		generate: (): string => {
			return globalThis.crypto.randomUUID();
		},
	};
}
