import { describe, expect, it, vi } from 'vitest';

import {
	LimiterExceededError,
	TopicExistsError,
	TopicNotFoundError,
} from '../src/helpers.js';
import { createMemoryLimiterDriver } from '#src/exports.js';

describe('MemoryLimiterDriver', () => {
	it('should create the expected public methods', () => {
		const limiter = createMemoryLimiterDriver();

		expect(limiter).toHaveProperty('createTopic');
		expect(limiter).toHaveProperty('getTopic');
		expect(limiter).toHaveProperty('hasTopic');
		expect(limiter).toHaveProperty('check');
		expect(limiter).toHaveProperty('consume');
		expect(limiter).toHaveProperty('authorize');
	});

	it('should create topics with default limits', async () => {
		const limiter = createMemoryLimiterDriver({ limit: 3, period: 10 });

		const topic = await limiter.createTopic({ key: 'login' });

		expect(topic).toEqual({ key: 'login', limit: 3, period: 10 });
		expect(await limiter.hasTopic({ key: 'login' })).toBe(true);
	});

	it('should create topics with topic-specific overrides', async () => {
		const limiter = createMemoryLimiterDriver({ limit: 3, period: 10 });

		await limiter.createTopic({ key: 'search', limit: 5, period: 20 });

		expect(await limiter.getTopic({ key: 'search' })).toEqual({
			key: 'search',
			limit: 5,
			period: 20,
		});
	});

	it('should throw when creating a duplicate topic', async () => {
		const limiter = createMemoryLimiterDriver();

		await limiter.createTopic({ key: 'login' });

		await expect(limiter.createTopic({ key: 'login' })).rejects.toBeInstanceOf(
			TopicExistsError,
		);
	});

	it('should throw when using an unknown topic', async () => {
		const limiter = createMemoryLimiterDriver();

		await expect(
			limiter.check({ topic: 'missing', identifier: 'user-1' }),
		).rejects.toBeInstanceOf(TopicNotFoundError);
	});

	it('should return a non-consuming status from check', async () => {
		const limiter = createMemoryLimiterDriver({ limit: 2, period: 30 });

		await limiter.createTopic({ key: 'login' });

		const first = await limiter.check({ topic: 'login', identifier: 'user-1' });
		const second = await limiter.check({
			topic: 'login',
			identifier: 'user-1',
		});

		expect(first.ok).toBe(true);
		expect(first.data.consumedPoints).toBe(0);
		expect(first.data.remainingPoints).toBe(2);
		expect(second.data.consumedPoints).toBe(0);
		expect(second.data.remainingPoints).toBe(2);
	});

	it('should consume tokens without throwing and expose limiter data', async () => {
		const limiter = createMemoryLimiterDriver({ limit: 2, period: 30 });

		await limiter.createTopic({ key: 'login' });

		const first = await limiter.consume({
			topic: 'login',
			identifier: 'user-1',
		});
		const second = await limiter.consume({
			topic: 'login',
			identifier: 'user-1',
		});
		const third = await limiter.consume({
			topic: 'login',
			identifier: 'user-1',
		});

		expect(first.ok).toBe(true);
		expect(first.data.consumedPoints).toBe(1);
		expect(first.data.remainingPoints).toBe(1);
		expect(second.ok).toBe(true);
		expect(second.data.remainingPoints).toBe(0);
		expect(third.ok).toBe(false);
		expect(third.data.remainingPoints).toBe(0);
		expect(third.data.msBeforeNext).toBeGreaterThan(0);
	});

	it('should reflect exhausted quota in check after consuming', async () => {
		const limiter = createMemoryLimiterDriver({ limit: 1, period: 30 });

		await limiter.createTopic({ key: 'login' });
		await limiter.consume({ topic: 'login', identifier: 'user-1' });

		const result = await limiter.check({
			topic: 'login',
			identifier: 'user-1',
		});

		expect(result.ok).toBe(false);
		expect(result.data.remainingPoints).toBe(0);
	});

	it('should isolate usage by topic for the same identifier', async () => {
		const limiter = createMemoryLimiterDriver({ limit: 1, period: 30 });

		await limiter.createTopic({ key: 'login' });
		await limiter.createTopic({ key: 'search', limit: 2, period: 30 });
		await limiter.consume({ topic: 'login', identifier: 'user-1' });

		const login = await limiter.check({ topic: 'login', identifier: 'user-1' });
		const search = await limiter.check({
			topic: 'search',
			identifier: 'user-1',
		});

		expect(login.ok).toBe(false);
		expect(search.ok).toBe(true);
		expect(search.data.remainingPoints).toBe(2);
	});

	it('should call a per-request exception handler in authorize', async () => {
		const limiter = createMemoryLimiterDriver({ limit: 1, period: 30 });
		const onException = vi.fn();

		await limiter.createTopic({ key: 'login' });
		await limiter.consume({ topic: 'login', identifier: 'user-1' });
		await limiter.authorize({
			topic: 'login',
			identifier: 'user-1',
			onException,
		});

		expect(onException).toHaveBeenCalledTimes(1);
		expect(onException.mock.calls[0]?.[0]).toMatchObject({
			remainingPoints: 0,
		});
	});

	it('should call the default exception handler from config', async () => {
		const onException = vi.fn();
		const limiter = createMemoryLimiterDriver({
			limit: 1,
			period: 30,
			onException,
		});

		await limiter.createTopic({ key: 'login' });
		await limiter.consume({ topic: 'login', identifier: 'user-1' });
		await limiter.authorize({ topic: 'login', identifier: 'user-1' });

		expect(onException).toHaveBeenCalledTimes(1);
	});

	it('should throw LimiterExceededError when authorize has no handler', async () => {
		const limiter = createMemoryLimiterDriver({ limit: 1, period: 30 });

		await limiter.createTopic({ key: 'login' });
		await limiter.consume({ topic: 'login', identifier: 'user-1' });

		await expect(
			limiter.authorize({ topic: 'login', identifier: 'user-1' }),
		).rejects.toBeInstanceOf(LimiterExceededError);
	});

	it('should validate topic and identifier inputs', async () => {
		const limiter = createMemoryLimiterDriver();

		await expect(limiter.createTopic({ key: '' })).rejects.toThrow(
			'topic must be a non-empty string',
		);
		await limiter.createTopic({ key: 'login' });
		await expect(
			limiter.consume({ topic: '', identifier: 'user-1' }),
		).rejects.toThrow('topic must be a non-empty string');
		await expect(
			limiter.consume({ topic: 'login', identifier: '' }),
		).rejects.toThrow('identifier must be a non-empty string');
		await expect(
			limiter.createTopic({ key: 'search', limit: 0, period: 10 }),
		).rejects.toThrow('limit must be greater than 0');
		await expect(
			limiter.createTopic({ key: 'signup', limit: 1, period: 0 }),
		).rejects.toThrow('period must be greater than 0');
	});
});
