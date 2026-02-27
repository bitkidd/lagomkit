import type { HasherDriver } from '../types.js';

import { createDigestDriver } from './shared.js';

export function createSha256Driver(): HasherDriver {
	return createDigestDriver('sha256');
}
