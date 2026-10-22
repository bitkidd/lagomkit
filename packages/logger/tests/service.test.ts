import { describe, expect, expectTypeOf, test } from 'vitest';
import {
	createConsolaLoggerDriver,
	createLoggerService,
} from '#src/exports.js';

describe('Logger::Service', () => {
	test('should return the configured drivers without wrapping them', () => {
		const local = createConsolaLoggerDriver({ options: { reporters: [] } });
		const remote = { ...local, dataset: 'logs' };
		const service = createLoggerService({
			default: 'local',
			drivers: { local, remote },
		});

		expect(service.default()).toBe(local);
		expect(service.use('local')).toBe(local);
		expect(service.use('remote')).toBe(remote);
		expectTypeOf(service.use('remote')).toEqualTypeOf<typeof remote>();
	});

	test('should reject unknown or inherited driver keys', () => {
		const service = createLoggerService({
			default: 'local',
			drivers: {
				local: createConsolaLoggerDriver({ options: { reporters: [] } }),
			},
		});

		expect(() =>
			// @ts-expect-error checking an unknown driver at runtime
			service.use('missing'),
		).toThrow('Logger driver "missing" is not defined');
		expect(() =>
			// @ts-expect-error checking inherited driver keys at runtime
			service.use('toString'),
		).toThrow('Logger driver "toString" is not defined');
	});

	test('should reject a missing default driver', () => {
		const service = createLoggerService({
			// @ts-expect-error checking an invalid default at runtime
			default: 'missing',
			drivers: {
				local: createConsolaLoggerDriver({ options: { reporters: [] } }),
			},
		});

		expect(() => service.default()).toThrow(
			'Logger driver "missing" is not defined',
		);
	});
});
