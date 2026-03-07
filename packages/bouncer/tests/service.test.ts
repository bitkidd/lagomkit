import { describe, expect, test, vi } from 'vitest';

import { createBouncerService, definePolicy } from '#src/service.js';
import { MockPolicy, MockPolicy2 } from './_helpers.js';

describe('Bouncer::Service', () => {
	const service = createBouncerService({
		policies: {
			MockPolicy: definePolicy({ handlers: MockPolicy }),
			MockPolicy2: definePolicy({ handlers: MockPolicy2 }),
		},
	});

	test('should return check method result', () => {
		expect(service.check({ policy: 'MockPolicy', action: 'authorized' })).toBe(
			true,
		);
	});

	test('should pass data to policy action', () => {
		expect(
			service.check({
				policy: 'MockPolicy',
				action: 'withData',
				data: { hello: 'world' },
			}),
		).toBe(true);
	});

	test('should throw on unknown policy check', () => {
		expect(() =>
			// @ts-expect-error checking undefined policy
			service.check({ policy: 'MockPolicy3', action: 'authorized' }),
		).toThrowError('Bouncer policy "MockPolicy3" is not defined');
	});

	test('should throw on unknown policy action check', () => {
		expect(() =>
			// @ts-expect-error checking undefined policy
			service.check({ policy: 'MockPolicy', action: 'authorizedd' }),
		).toThrowError(
			'Bouncer policy "MockPolicy" action "authorizedd" is not defined',
		);
	});

	test('should execute authorize method', () => {
		expect(() =>
			service.authorize({ policy: 'MockPolicy', action: 'unauthorizedThrow' }),
		).toThrowError(
			'Bouncer policy "MockPolicy" action "unauthorizedThrow" is not authorized',
		);
	});

	test('should execute authorize method and throw', () => {
		expect(() =>
			service.authorize({
				policy: 'MockPolicy',
				action: 'unauthorizedThrow',
				onException: () => {
					throw new Error('Hello World');
				},
			}),
		).toThrowError('Hello World');
	});

	test('should execute service-level onException handler', () => {
		const onException = vi.fn();
		const localService = createBouncerService({
			policies: {
				MockPolicy: definePolicy({ handlers: MockPolicy }),
				MockPolicy2: definePolicy({ handlers: MockPolicy2 }),
			},
			onException,
		});

		localService.authorize({
			policy: 'MockPolicy',
			action: 'unauthorizedThrow',
		});

		expect(onException).toHaveBeenCalledTimes(1);
	});

	test('should throw on unknown policy authorize', () => {
		expect(() =>
			// @ts-expect-error checking undefined policy
			service.authorize({ policy: 'MockPolicy3', action: 'authorized' }),
		).toThrowError('Bouncer policy "MockPolicy3" is not defined');
	});

	test('should throw on unknown policy action authorize', () => {
		expect(() =>
			// @ts-expect-error checking undefined policy
			service.authorize({ policy: 'MockPolicy', action: 'authorizedd' }),
		).toThrowError(
			'Bouncer policy "MockPolicy" action "authorizedd" is not defined',
		);
	});

	test('should rethrow policy errors from check', () => {
		expect(() =>
			service.check({ policy: 'MockPolicy', action: 'throws' }),
		).toThrowError('Policy exploded');
	});

	test('should rethrow policy errors from authorize', () => {
		expect(() =>
			service.authorize({ policy: 'MockPolicy', action: 'throws' }),
		).toThrowError('Policy exploded');
	});

	test('should support definePolicy declarations', () => {
		const localService = createBouncerService({
			policies: {
				post: definePolicy({
					handlers: {
						create: (input?: { role: 'admin' | 'editor' | 'viewer' }) => {
							return input?.role === 'admin' || input?.role === 'editor';
						},
					},
				}),
			},
		});

		expect(
			localService.check({
				policy: 'post',
				action: 'create',
				data: { role: 'editor' },
			}),
		).toBe(true);
	});
});
