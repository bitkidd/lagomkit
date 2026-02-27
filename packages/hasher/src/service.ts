import type { HasherDriver, HasherService } from './types.js';

export function createHasherService<
	KnownHashers extends Record<string, HasherDriver>,
>(config: {
	default: keyof KnownHashers;
	drivers: KnownHashers;
}): HasherService<KnownHashers> {
	return {
		default: () => {
			const found = config.drivers[config.default];

			if (!found) {
				throw new Error(
					`Hasher driver "${String(config.default)}" not defined`,
				);
			}

			return found;
		},
		use: <Key extends keyof KnownHashers>(driver: Key): KnownHashers[Key] => {
			const found = config.drivers[driver];

			if (!found) {
				throw new Error(`Hasher driver "${String(driver)}" is not defined`);
			}

			return found;
		},
	};
}
