export type RandomGeneratorDriverContract<Options = any> = {
	generate: (args?: Options) => string;
};

export type RandomGeneratorServiceContract<
	KnownRandomGeneratorDrivers extends Record<
		string,
		RandomGeneratorDriverContract
	>,
> = {
	default: () => RandomGeneratorDriverContract;
	use: <Key extends keyof KnownRandomGeneratorDrivers>(
		driver: Key,
	) => KnownRandomGeneratorDrivers[Key];
};
