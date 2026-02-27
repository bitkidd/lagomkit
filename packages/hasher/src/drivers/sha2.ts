import type { HasherDriver } from '#src/types.js';

import { createDigestDriver } from './shared.js';

export function createSha2_224Driver(): HasherDriver {
	return createDigestDriver('sha224');
}

export function createSha2_256Driver(): HasherDriver {
	return createDigestDriver('sha256');
}

export function createSha2_384Driver(): HasherDriver {
	return createDigestDriver('sha384');
}

export function createSha2_512Driver(): HasherDriver {
	return createDigestDriver('sha512');
}
