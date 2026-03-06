import type { FlasherDriverContract, FlasherServiceContract } from './types.js';

/**
 * Creates a flasher service from a typed driver map.
 *
 * @param config.default Driver key used by `default()`.
 * @param config.drivers Available flasher drivers.
 */
export function createFlasherService<
	KnownDrivers extends Record<string, FlasherDriverContract>,
>(config: {
	default: keyof KnownDrivers;
	drivers: KnownDrivers;
}): FlasherServiceContract<KnownDrivers> {
	return {
		default: () => {
			const found = config.drivers[config.default];

			if (!found) {
				throw new Error(
					`Flasher driver "${String(config.default)}" not defined`,
				);
			}

			return found;
		},
		use: <Key extends keyof KnownDrivers>(driver: Key): KnownDrivers[Key] => {
			const found = config.drivers[driver];

			if (!found) {
				throw new Error(`Flasher driver "${String(driver)}" is not defined`);
			}

			return found;
		},
	};
}
