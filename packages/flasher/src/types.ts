/**
 * Contract implemented by flasher drivers.
 */
export interface FlasherDriverContract {
	/**
	 * Stores a value and returns its generated flash id.
	 */
	set: <T>(value: T, options?: { ttlMs?: number }) => Promise<string>;
	/**
	 * Reads and consumes a value by id.
	 */
	get: <T>(id: string) => Promise<T | undefined>;
	/**
	 * Reads a value by id without consuming it.
	 */
	peek: <T>(id: string) => Promise<T | undefined>;
	/**
	 * Reads and consumes many values by ids.
	 */
	getMany: <T>(ids: string[]) => Promise<Record<string, T>>;
	/**
	 * Reads many values by ids without consuming them.
	 */
	peekMany: <T>(ids: string[]) => Promise<Record<string, T>>;
	/**
	 * Deletes a value by id.
	 */
	erase: (id: string) => Promise<void>;
	/**
	 * Deletes all stored values.
	 */
	clear: () => Promise<void>;
}

/**
 * Typed flasher service API.
 */
export interface FlasherServiceContract<
	KnownDrivers extends Record<string, FlasherDriverContract>,
> {
	/**
	 * Returns the configured default flasher driver.
	 */
	default: () => FlasherDriverContract;
	/**
	 * Returns a flasher driver by key.
	 */
	use: <Key extends keyof KnownDrivers>(driver: Key) => KnownDrivers[Key];
}
