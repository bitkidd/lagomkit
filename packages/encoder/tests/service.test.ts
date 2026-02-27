import { describe, expect, test } from 'vitest';
import { createBase32Driver, createEncoderService } from '#src/exports.js';

describe('Encoder::Service', () => {
	const service = createEncoderService({
		default: 'base32',
		drivers: {
			base32: createBase32Driver(),
		},
	});

	test('should return expected methods', () => {
		expect(service).toHaveProperty('default');
		expect(service).toHaveProperty('use');
		expect(typeof service.use).toBe('function');
	});

	test('should return driver on policy call', async () => {
		const driver = service.use('base32');

		expect(driver).toHaveProperty('encode');
		expect(driver).toHaveProperty('decode');
	});

	test('should throw on unknown driver', async () => {
		//@ts-expect-error checking unknown driver
		expect(() => service.use('unknown')).toThrowError(
			'Encoder driver "unknown" is not defined',
		);
	});
});
