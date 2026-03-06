import { describe, expect, test } from 'vitest';
import {
	createLimiterService,
	createMemoryLimiterDriver,
} from '../src/exports.js';

const service = createLimiterService({
	default: 'memory',
	drivers: {
		memory: createMemoryLimiterDriver(),
	},
});

describe('Limiter::Service', () => {
	test('should return expected methods', () => {
		expect(service).toHaveProperty('default');
		expect(service).toHaveProperty('use');
		expect(typeof service.use).toBe('function');
	});

	test('should return driver on policy call', async () => {
		const driver = service.use('memory');

		expect(driver).toHaveProperty('check');
		expect(driver).toHaveProperty('authorize');
		expect(driver).toHaveProperty('createTopic');
	});

	test('should throw on unknown driver', async () => {
		//@ts-expect-error driver uknown
		expect(() => service.use('unknown')).toThrowError(
			'Limiter driver "unknown" is not defined',
		);
	});
});
