import { describe, it, expect, vi } from 'vitest';
import { createMemoryLimiterDriver } from '../src/drivers/memory.js';

describe('MemoryLimiterDriver', () => {
	it('should create memory driver from factory', () => {
		const limiter = createMemoryLimiterDriver({ limit: 2, period: 30 });

		expect(limiter).toHaveProperty('createTopic');
		expect(limiter).toHaveProperty('check');
		expect(limiter).toHaveProperty('authorize');
	});

	it('should create a topic with default limits', async () => {
		const limiter = createMemoryLimiterDriver({ limit: 3, period: 10 });
		await limiter.createTopic({ key: 'test-topic' });
		expect(await limiter.hasTopic({ key: 'test-topic' })).toBe(true);
	});

	it('should respect topic-specific limits', async () => {
		const limiter = createMemoryLimiterDriver({ limit: 3, period: 10 });
		await limiter.createTopic({ key: 'test-topic', limit: 5, period: 20 });
		const topic = await limiter.getTopic({ key: 'test-topic' });

		expect(topic?.limit).toBe(5);
		expect(topic?.period).toBe(20);
	});

	it('should allow actions within limit', async () => {
		const limiter = createMemoryLimiterDriver({ limit: 3, period: 10 });
		await limiter.createTopic({ key: 'test-topic' });
		const identifier = 'user-1';

		expect(
			(await limiter.check({ topic: 'test-topic', identifier })).limited,
		).toBe(false);
		expect(
			(await limiter.check({ topic: 'test-topic', identifier })).limited,
		).toBe(false);
		expect(
			(await limiter.check({ topic: 'test-topic', identifier })).limited,
		).toBe(false);
	});

	it('should block actions when limit is exceeded', async () => {
		const limiter = createMemoryLimiterDriver({ limit: 3, period: 10 });

		await limiter.createTopic({ key: 'test-topic' });
		const identifier = 'user-1';

		await limiter.check({ topic: 'test-topic', identifier });
		await limiter.check({ topic: 'test-topic', identifier });
		await limiter.check({ topic: 'test-topic', identifier });
		expect(
			(await limiter.check({ topic: 'test-topic', identifier })).limited,
		).toBe(true);
	});

	it('should throw error when checking non-existent topic', async () => {
		const limiter = createMemoryLimiterDriver({ limit: 3, period: 10 });

		await expect(
			limiter.check({ topic: 'invalid-topic', identifier: 'user-1' }),
		).rejects.toThrow('Topic not found: invalid-topic');
	});

	it('should call exception handler when action is blocked', async () => {
		const limiter = createMemoryLimiterDriver({ limit: 3, period: 10 });

		const exceptionHandler = vi.fn();
		limiter.setExceptionHandler(exceptionHandler);

		await limiter.createTopic({ key: 'test-topic' });
		const identifier = 'user-1';

		await limiter.check({ topic: 'test-topic', identifier });
		await limiter.check({ topic: 'test-topic', identifier });
		await limiter.check({ topic: 'test-topic', identifier });
		await limiter.authorize({ topic: 'test-topic', identifier });

		expect(exceptionHandler).toHaveBeenCalled();
	});

	it('should throw error when no exception handler is set and limit is exceeded', async () => {
		const limiter = createMemoryLimiterDriver({ limit: 3, period: 10 });
		await limiter.createTopic({ key: 'test-topic' });
		const identifier = 'user-1';

		await limiter.check({ topic: 'test-topic', identifier });
		await limiter.check({ topic: 'test-topic', identifier });
		await limiter.check({ topic: 'test-topic', identifier });

		await expect(
			limiter.authorize({ topic: 'test-topic', identifier }),
		).rejects.toThrow('You are not allowed to perform this action');
	});

	it('should cleanup stale usage entries', async () => {
		const limiter = createMemoryLimiterDriver({ limit: 3, period: 1 });
		await limiter.createTopic({ key: 'test-topic' });

		await limiter.check({ topic: 'test-topic', identifier: 'user-1' });

		await new Promise((resolve) => {
			setTimeout(resolve, 1100);
		});

		const removed = await limiter.cleanup({ topic: 'test-topic' });
		const topic = await limiter.getTopic({ key: 'test-topic' });

		expect(removed).toBeGreaterThan(0);
		expect(topic?.usage.size).toBe(0);
	});

	it('should validate createTopic input', async () => {
		const limiter = createMemoryLimiterDriver();

		await expect(
			limiter.createTopic({ key: '', limit: 1, period: 1 }),
		).rejects.toThrow('topic must be a non-empty string');
		await expect(
			limiter.createTopic({ key: 'x', limit: 0, period: 1 }),
		).rejects.toThrow('limit must be greater than 0');
		await expect(
			limiter.createTopic({ key: 'x', limit: 1, period: 0 }),
		).rejects.toThrow('period must be greater than 0');
	});

	it('should validate check input', async () => {
		const limiter = createMemoryLimiterDriver();
		await limiter.createTopic({ key: 'test-topic' });

		await expect(
			limiter.check({ topic: '', identifier: 'id' }),
		).rejects.toThrow('topic must be a non-empty string');
		await expect(
			limiter.check({ topic: 'test-topic', identifier: '' }),
		).rejects.toThrow('identifier must be a non-empty string');
	});

	it('should validate hasTopic input', async () => {
		const limiter = createMemoryLimiterDriver();

		await expect(limiter.hasTopic({ key: '' })).rejects.toThrow(
			'topic must be a non-empty string',
		);
	});

	it('should report hasExceptionHandler accurately', async () => {
		const limiter = createMemoryLimiterDriver();
		expect(limiter.hasExceptionHandler()).toBe(false);

		const handler = vi.fn();
		limiter.setExceptionHandler(handler);
		expect(limiter.hasExceptionHandler()).toBe(true);
	});

	it('should protect getTopic from external mutation', async () => {
		const limiter = createMemoryLimiterDriver();
		await limiter.createTopic({ key: 'test-topic' });
		await limiter.check({ topic: 'test-topic', identifier: 'user-1' });

		const snapshot = await limiter.getTopic({ key: 'test-topic' });
		snapshot!.usage.set('mutated', [Date.now()]);

		const fresh = await limiter.getTopic({ key: 'test-topic' });
		expect(fresh!.usage.has('mutated')).toBe(false);
	});
});
