import type { StorageDriverContract, StorageServiceContract } from './types.js';

/** Creates a storage service from a typed map of interchangeable drivers. */
export function createStorageService<
	KnownStorage extends Record<string, StorageDriverContract>,
>(config: {
	default: keyof KnownStorage;
	drivers: KnownStorage;
}): StorageServiceContract<KnownStorage> {
	const getDriver = <Key extends keyof KnownStorage>(
		key: Key,
	): KnownStorage[Key] => {
		const driver = config.drivers[key];

		if (!Object.hasOwn(config.drivers, key) || !driver) {
			throw new Error(`Storage driver "${String(key)}" is not defined`);
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
