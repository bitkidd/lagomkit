import type { HasherDriver } from '#src/types.js';

import { createDigestDriver } from './shared.js';

export function createSha256Driver(): HasherDriver {
	return createDigestDriver('sha256');
}
