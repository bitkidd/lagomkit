import type { HasherDriver } from '#src/types.js';

import { hash, verify } from '@node-rs/argon2';

/**
 * Creates an Argon2id hasher driver.
 */
export function createArgon2Driver(): HasherDriver {
	return {
		async hash({ content }: { content: string }): Promise<string> {
			return await hash(content.normalize('NFKC'), { algorithm: 2 });
		},
		async verify({
			content,
			hash: hashed,
		}: {
			content: string;
			hash: string;
		}): Promise<boolean> {
			return await verify(hashed, content.normalize('NFKC'));
		},
	};
}
