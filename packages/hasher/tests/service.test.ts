import { describe, expect, test } from 'vitest';
import { createHasherService, createSha2_256Driver } from '#src/exports.js';

const service = createHasherService({
	default: 'sha256',
	drivers: {
		sha256: createSha2_256Driver(),
	},
});

describe('Hasher::Service', () => {
	test('should return expected methods', () => {
		expect(service).toHaveProperty('default');
		expect(service).toHaveProperty('use');
	});

	test('should return driver on policy call', async () => {
		const driver = service.use('sha256');

		expect(driver).toHaveProperty('hash');
		expect(driver).toHaveProperty('verify');
	});

	test('should throw on unknown driver', async () => {
		//@ts-expect-error checking unknown driver
		expect(() => service.use('unknown')).toThrowError(
			'Hasher driver "unknown" is not defined',
		);
	});
});
