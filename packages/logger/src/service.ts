import type { LoggerDriverContract, LoggerServiceContract } from './types.js';

/**
 * Creates a logger service from a typed driver map.
 *
 * @param config.default Driver key used by `default()`.
 * @param config.drivers Available logger drivers.
 */
export function createLoggerService<
	KnownLoggers extends Record<string, LoggerDriverContract>,
>(config: {
	default: keyof KnownLoggers;
	drivers: KnownLoggers;
}): LoggerServiceContract<KnownLoggers> {
	const getDriver = <Key extends keyof KnownLoggers>(
		key: Key,
	): KnownLoggers[Key] => {
		const driver = config.drivers[key];

		if (!Object.hasOwn(config.drivers, key) || !driver) {
			throw new Error(`Logger driver "${String(key)}" is not defined`);
		}

		return driver;
	};

	return {
		default: () => {
			return getDriver(config.default);
		},
		use: getDriver,
	};
}
