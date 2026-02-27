import type { HasherDriver } from '../types.js';

import { createDigestDriver } from './shared.js';

export function createSha3_224Driver(): HasherDriver {
	return createDigestDriver('sha3-224');
}

export function createSha3_256Driver(): HasherDriver {
	return createDigestDriver('sha3-256');
}

export function createSha3_384Driver(): HasherDriver {
	return createDigestDriver('sha3-384');
}

export function createSha3_512Driver(): HasherDriver {
	return createDigestDriver('sha3-512');
}
