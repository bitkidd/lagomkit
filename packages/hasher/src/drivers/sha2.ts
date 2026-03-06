import type { HasherDriver } from '#src/types.js';

import { createDigestDriver } from './shared.js';

/**
 * Creates an SHA-224 hasher driver.
 */
export function createSha2_224Driver(): HasherDriver {
	return createDigestDriver('sha224');
}

/**
 * Creates an SHA-256 hasher driver.
 */
export function createSha2_256Driver(): HasherDriver {
	return createDigestDriver('sha256');
}

/**
 * Creates an SHA-384 hasher driver.
 */
export function createSha2_384Driver(): HasherDriver {
	return createDigestDriver('sha384');
}

/**
 * Creates an SHA-512 hasher driver.
 */
export function createSha2_512Driver(): HasherDriver {
	return createDigestDriver('sha512');
}
