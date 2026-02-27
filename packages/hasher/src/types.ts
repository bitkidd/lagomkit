export type HasherDriver = {
	hash: ({ content }: { content: string }) => Promise<string>;
	verify: ({
		content,
		hash,
	}: {
		content: string;
		hash: string;
	}) => Promise<boolean>;
};

export type HasherService<KnownHashers extends Record<string, HasherDriver>> = {
	default: () => HasherDriver;
	use: <Key extends keyof KnownHashers>(driver: Key) => KnownHashers[Key];
};
