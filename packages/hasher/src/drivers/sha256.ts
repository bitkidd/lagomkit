import type { HasherDriver } from '#src/types.js';

import { createDigestDriver } from './shared.js';

/**
 * Creates an SHA-256 hasher driver.
 */
export function createSha256Driver(): HasherDriver {
	return createDigestDriver('sha256');
}
