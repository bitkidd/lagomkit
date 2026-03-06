import type { HasherDriver } from '#src/types.js';

import { createDigestDriver } from './shared.js';

/**
 * Creates an SHA3-224 hasher driver.
 */
export function createSha3_224Driver(): HasherDriver {
	return createDigestDriver('sha3-224');
}

/**
 * Creates an SHA3-256 hasher driver.
 */
export function createSha3_256Driver(): HasherDriver {
	return createDigestDriver('sha3-256');
}

/**
 * Creates an SHA3-384 hasher driver.
 */
export function createSha3_384Driver(): HasherDriver {
	return createDigestDriver('sha3-384');
}

/**
 * Creates an SHA3-512 hasher driver.
 */
export function createSha3_512Driver(): HasherDriver {
	return createDigestDriver('sha3-512');
}
