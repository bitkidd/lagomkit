/**
 * Contract implemented by all random generator drivers.
 */
export type RandomGeneratorDriverContract<Options = any> = {
	/**
	 * Generates a random string using driver-specific options.
	 */
	generate: (args?: Options) => string;
};

/**
 * Typed random generator service API.
 */
export type RandomGeneratorServiceContract<
	KnownRandomGeneratorDrivers extends Record<
		string,
		RandomGeneratorDriverContract
	>,
> = {
	/**
	 * Returns the configured default random driver.
	 */
	default: () => RandomGeneratorDriverContract;
	/**
	 * Returns a random driver by key.
	 */
	use: <Key extends keyof KnownRandomGeneratorDrivers>(
		driver: Key,
	) => KnownRandomGeneratorDrivers[Key];
};
