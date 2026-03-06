import type {
	RandomGeneratorServiceContract,
	RandomGeneratorDriverContract,
} from './types.js';

/**
 * Creates a random generator service from a typed driver map.
 *
 * @param config.default Driver key used by `default()`.
 * @param config.drivers Available random generator drivers.
 */
export function createRandomGeneratorService<
	KnownDrivers extends Record<string, RandomGeneratorDriverContract>,
>(config: {
	default: keyof KnownDrivers;
	drivers: KnownDrivers;
}): RandomGeneratorServiceContract<KnownDrivers> {
	return {
		default: () => {
			const found = config.drivers[config.default];

			if (!found) {
				throw new Error(
					`Random Generator driver "${String(config.default)}" not defined`,
				);
			}

			return found;
		},
		use: <Key extends keyof KnownDrivers>(driver: Key): KnownDrivers[Key] => {
			const found = config.drivers[driver];

			if (!found) {
				throw new Error(
					`Random Generator driver "${String(driver)}" is not defined`,
				);
			}

			return found;
		},
	};
}
