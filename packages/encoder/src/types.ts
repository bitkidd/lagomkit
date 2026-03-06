/**
 * Contract implemented by all encoder drivers.
 */
export interface EncoderDriver {
	/**
	 * Encodes a byte array into a string representation.
	 */
	encode: (params: {
		data: Uint8Array;
		options?: { includePadding?: boolean };
	}) => string;
	/**
	 * Decodes an encoded string back into bytes.
	 */
	decode: (params: { data: string }) => Uint8Array;
}

/**
 * Typed encoder service API.
 */
export interface EncoderService<
	KnownEncoders extends Record<string, EncoderDriver>,
> {
	/**
	 * Returns the configured default encoder driver.
	 */
	default: () => EncoderDriver;
	/**
	 * Returns an encoder driver by key.
	 */
	use: <Key extends keyof KnownEncoders>(driver: Key) => KnownEncoders[Key];
}
