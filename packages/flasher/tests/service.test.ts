import { describe, expect, test } from 'vitest';
import {
	createFlasherService,
	createMemoryFlasherDriver,
} from '../src/exports.js';

const service = createFlasherService({
	default: 'memory',
	drivers: {
		memory: createMemoryFlasherDriver(),
	},
});

describe('Flasher::Service', () => {
	test('should return expected methods', () => {
		expect(service).toHaveProperty('default');
		expect(service).toHaveProperty('use');
	});

	test('should return driver from use', async () => {
		const driver = service.use('memory');

		expect(driver).toHaveProperty('set');
		expect(driver).toHaveProperty('get');
		expect(driver).toHaveProperty('peek');
		expect(driver).toHaveProperty('getMany');
		expect(driver).toHaveProperty('peekMany');
		expect(driver).toHaveProperty('erase');
		expect(driver).toHaveProperty('clear');
	});

	test('should return default driver', async () => {
		const driver = service.default();

		expect(driver).toHaveProperty('set');
		expect(driver).toHaveProperty('get');
	});

	test('should throw on unknown driver', async () => {
		// @ts-expect-error checking unknown driver
		expect(() => service.use('unknown')).toThrowError(
			'Flasher driver "unknown" is not defined',
		);
	});
});
