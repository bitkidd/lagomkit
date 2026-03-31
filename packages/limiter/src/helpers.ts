import type { RateLimiterRes } from 'rate-limiter-flexible';

export class TopicExistsError extends Error {
	constructor(topic: string) {
		super(`Topic already exists: ${topic}`);
		this.name = 'TopicExistsError';
	}
}

export class TopicNotFoundError extends Error {
	constructor(topic: string) {
		super(`Topic not found: ${topic}`);
		this.name = 'TopicNotFoundError';
	}
}

export class LimiterExceededError extends Error {
	readonly data: RateLimiterRes;

	constructor(data: RateLimiterRes) {
		super('Too many requests');
		this.name = 'LimiterExceededError';
		this.data = data;
	}
}
