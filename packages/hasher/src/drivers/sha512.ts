import type { HasherDriver } from '#src/types.js';

import { createDigestDriver } from './shared.js';

/**
 * Creates an SHA-512 hasher driver.
 */
export function createSha512Driver(): HasherDriver {
	return createDigestDriver('sha512');
}
