import type { HasherDriver } from '#src/types.js';

import { createDigestDriver } from './shared.js';

export function createSha512Driver(): HasherDriver {
	return createDigestDriver('sha512');
}
