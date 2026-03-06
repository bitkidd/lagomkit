import type { HasherDriver } from '#src/types.js';

import { createDigestDriver } from './shared.js';

/**
 * Creates an SHA-1 hasher driver.
 */
export function createSha1Driver(): HasherDriver {
	return createDigestDriver('sha1');
}
