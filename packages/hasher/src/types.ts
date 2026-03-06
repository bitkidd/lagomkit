/**
 * Contract implemented by all hash drivers.
 */
export type HasherDriver = {
	/**
	 * Produces a hash for the provided content.
	 */
	hash: ({ content }: { content: string }) => Promise<string>;
	/**
	 * Verifies content against an existing hash.
	 */
	verify: ({
		content,
		hash,
	}: {
		content: string;
		hash: string;
	}) => Promise<boolean>;
};

/**
 * Typed hasher service API.
 */
export type HasherService<KnownHashers extends Record<string, HasherDriver>> = {
	/**
	 * Returns the configured default hasher driver.
	 */
	default: () => HasherDriver;
	/**
	 * Returns a hasher driver by key.
	 */
	use: <Key extends keyof KnownHashers>(driver: Key) => KnownHashers[Key];
};
