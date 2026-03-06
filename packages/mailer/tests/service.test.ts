import { describe, expect, test } from 'vitest';
import { createMailerService } from '../src/exports.js';

const service = createMailerService({
	default: 'smtp',
	drivers: {
		smtp: {
			send: async () => {
				return undefined;
			},
		},
	},
});

describe('Mailer::Service', () => {
	test('should return expected methods', () => {
		expect(service).toHaveProperty('default');
		expect(service).toHaveProperty('use');
		expect(typeof service.use).toBe('function');
	});

	test('should return driver on policy call', async () => {
		const driver = service.use('smtp');

		expect(driver).toHaveProperty('send');
	});

	test('should throw on unknown driver', async () => {
		// @ts-expect-error checking unknown driver
		expect(() => service.use('unknown')).toThrowError(
			'Mailer driver "unknown" is not defined',
		);
	});
});
