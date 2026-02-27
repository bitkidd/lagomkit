import type { HasherDriver } from '../types.js';

import { createDigestDriver } from './shared.js';

export function createSha1Driver(): HasherDriver {
	return createDigestDriver('sha1');
}
