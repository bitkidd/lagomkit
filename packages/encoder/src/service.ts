import type { EncoderDriver, EncoderService } from './types.js';

/**
 * Creates an encoder service from a typed driver map.
 *
 * @param config.default Driver key used by `default()`.
 * @param config.drivers Available encoder drivers.
 */
export function createEncoderService<
	KnownEncoders extends Record<string, EncoderDriver>,
>(config: {
	default: keyof KnownEncoders;
	drivers: KnownEncoders;
}): EncoderService<KnownEncoders> {
	return {
		default: () => {
			const found = config.drivers[config.default];

			if (!found) {
				throw new Error(
					`Encoder driver "${String(config.default)}" not defined`,
				);
			}

			return found;
		},
		use: <Name extends keyof KnownEncoders>(
			driver: Name,
		): KnownEncoders[Name] => {
			const found = config.drivers[driver];

			if (!found) {
				throw new Error(`Encoder driver "${String(driver)}" is not defined`);
			}

			return found;
		},
	};
}
