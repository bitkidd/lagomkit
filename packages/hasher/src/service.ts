import type { HasherDriver, HasherService } from './types.js';

/**
 * Creates a hasher service from a typed driver map.
 *
 * @param config.default Driver key used by `default()`.
 * @param config.drivers Available hasher drivers.
 */
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
