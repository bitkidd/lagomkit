import type { HasherDriver } from '#src/types.js';

import { hash, verify } from '@node-rs/bcrypt';

export function createBcryptDriver(config?: { cost?: number }): HasherDriver {
	const cost = config?.cost ?? 10;

	return {
		async hash({ content }: { content: string }): Promise<string> {
			return await hash(content.normalize('NFKC'), cost);
		},
		async verify({
			content,
			hash: hashed,
		}: {
			content: string;
			hash: string;
		}): Promise<boolean> {
			return await verify(content.normalize('NFKC'), hashed);
		},
	};
}
