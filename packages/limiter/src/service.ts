import type { LimiterDriverContract, LimiterServiceContract } from './types.js';

export function createLimiterService<
	KnownLimiters extends Record<string, LimiterDriverContract>,
>(config: {
	default: keyof KnownLimiters;
	drivers: KnownLimiters;
}): LimiterServiceContract<KnownLimiters> {
	return {
		default: () => {
			const found = config.drivers[config.default];

			if (!found) {
				throw new Error(
					`Limiter driver "${String(config.default)}" not defined`,
				);
			}

			return found;
		},
		use: <Key extends keyof KnownLimiters>(driver: Key): KnownLimiters[Key] => {
			const found = config.drivers[driver];

			if (!found) {
				throw new Error(`Limiter driver "${String(driver)}" is not defined`);
			}

			return found;
		},
	};
}
