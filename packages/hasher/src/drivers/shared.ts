import { createHash } from 'node:crypto';

import { timingSafeEqual } from '../helpers.js';
import type { HasherDriver } from '#src/types.js';

type DigestAlgorithm =
	| 'sha1'
	| 'sha224'
	| 'sha256'
	| 'sha384'
	| 'sha512'
	| 'sha3-224'
	| 'sha3-256'
	| 'sha3-384'
	| 'sha3-512';

function computeDigest({
	content,
	algorithm,
}: {
	content: string;
	algorithm: DigestAlgorithm;
}): string {
	return createHash(algorithm).update(content.normalize('NFKC')).digest('hex');
}

/**
 * Creates a digest-based hasher driver for the given algorithm.
 */
export function createDigestDriver(algorithm: DigestAlgorithm): HasherDriver {
	return {
		async hash({ content }: { content: string }): Promise<string> {
			return computeDigest({ content, algorithm });
		},
		async verify({
			content,
			hash,
		}: {
			content: string;
			hash: string;
		}): Promise<boolean> {
			const generatedHash = computeDigest({ content, algorithm });
			return timingSafeEqual(generatedHash, hash);
		},
	};
}
