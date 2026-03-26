import { describe, expect, test } from 'vitest';

import {
	createLimiterService,
	createMemoryLimiterDriver,
} from '../src/exports.js';

describe('Limiter::Service', () => {
	test('should return expected methods', () => {
		const service = createLimiterService({
			default: 'memory',
			drivers: {
				memory: createMemoryLimiterDriver(),
			},
		});

		expect(service).toHaveProperty('default');
		expect(service).toHaveProperty('use');
		expect(typeof service.default).toBe('function');
		expect(typeof service.use).toBe('function');
	});

	test('should return a typed driver from default and use', () => {
		const memory = createMemoryLimiterDriver();
		const service = createLimiterService({
			default: 'memory',
			drivers: {
				memory,
			},
		});

		expect(service.default()).toBe(memory);
		expect(service.use('memory')).toBe(memory);
		expect(service.default()).toHaveProperty('createTopic');
		expect(service.default()).toHaveProperty('consume');
	});

	test('should throw on unknown driver', () => {
		const service = createLimiterService({
			default: 'memory',
			drivers: {
				memory: createMemoryLimiterDriver(),
			},
		});

		// @ts-expect-error testing runtime safety for unknown driver access
		expect(() => service.use('unknown')).toThrowError(
			'Limiter driver "unknown" is not defined',
		);
	});
});
