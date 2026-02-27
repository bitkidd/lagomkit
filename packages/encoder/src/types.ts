export interface EncoderDriver {
	encode: (params: {
		data: Uint8Array;
		options?: { includePadding?: boolean };
	}) => string;
	decode: (params: { data: string }) => Uint8Array;
}

export interface EncoderService<
	KnownEncoders extends Record<string, EncoderDriver>,
> {
	default: () => EncoderDriver;
	use: <Key extends keyof KnownEncoders>(driver: Key) => KnownEncoders[Key];
}
