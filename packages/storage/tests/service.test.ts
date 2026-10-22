import { describe, expect, expectTypeOf, test } from 'vitest';
import {
	createLocalStorageDriver,
	createStorageService,
} from '#src/exports.js';

describe('Storage::Service', () => {
	test('returns configured drivers and preserves their concrete types', () => {
		const local = createLocalStorageDriver({
			root: '/tmp/lagomkit-storage-service',
		});
		const remote = { ...local, bucket: 'uploads' };
		const service = createStorageService({
			default: 'local',
			drivers: { local, remote },
		});

		expect(service.default()).toBe(local);
		expect(service.use('local')).toBe(local);
		expect(service.use('remote')).toBe(remote);
		expectTypeOf(service.use('remote')).toEqualTypeOf<typeof remote>();

		// @ts-expect-error unknown driver names must fail at compile time and runtime
		expect(() => service.use('missing')).toThrow(
			'Storage driver "missing" is not defined',
		);
		// @ts-expect-error inherited properties are not drivers
		expect(() => service.use('toString')).toThrow(
			'Storage driver "toString" is not defined',
		);
	});

	test('rejects an invalid default at runtime', () => {
		const service = createStorageService({
			// @ts-expect-error invalid JavaScript configuration
			default: 'missing',
			drivers: {
				local: createLocalStorageDriver({
					root: '/tmp/lagomkit-storage-service',
				}),
			},
		});

		expect(() => service.default()).toThrow(
			'Storage driver "missing" is not defined',
		);
	});
});
