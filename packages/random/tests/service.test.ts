import { describe, expect, test } from 'vitest';
import {
	createRandomGeneratorService,
	createRandomStringDriver,
} from '#src/exports.js';

const service = createRandomGeneratorService({
	default: 'string',
	drivers: {
		string: createRandomStringDriver(),
	},
});

describe('Random::Service', () => {
	test('should return expected methods', () => {
		expect(service).toHaveProperty('default');
		expect(service).toHaveProperty('use');
	});

	test('should return driver on random generator call', async () => {
		const driver = service.use('string');

		expect(driver).toHaveProperty('generate');
	});

	test('should throw on unknown driver', async () => {
		//@ts-expect-error checking unknown driver
		expect(() => service.use('unknown')).toThrowError(
			'Random Generator driver "unknown" is not defined',
		);
	});
});
