import type { RateLimiterRes } from 'rate-limiter-flexible';

export interface LimiterDriverConfig {
	limit?: number;
	period?: number;
	keyPrefix?: string;
	blockDuration?: number;
	execEvenly?: boolean;
	execEvenlyMinDelayMs?: number;
	onException?: (data: RateLimiterRes) => void;
}

export interface LimiterTopicConfig {
	key: string;
	limit?: number;
	period?: number;
}

export interface LimiterTopic {
	key: string;
	limit: number;
	period: number;
}

export interface LimiterTopicRequest {
	topic: string;
	identifier: string;
}

export interface LimiterAuthorizeRequest extends LimiterTopicRequest {
	onException?: (data: RateLimiterRes) => void;
}

export type LimiterResult =
	| { ok: true; data: RateLimiterRes }
	| { ok: false; data: RateLimiterRes };

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

/**
 *  Limiter driver implementation
 */
export interface LimiterDriver {
	/**
	 * Creates an explicit topic with optional per-topic overrides.
	 */
	createTopic: (input: LimiterTopicConfig) => Promise<LimiterTopic>;

	/**
	 * Returns topic metadata, or null if it does not exist.
	 */
	getTopic: (
		input: Pick<LimiterTopicConfig, 'key'>,
	) => Promise<LimiterTopic | null>;

	/**
	 * Checks whether a topic exists.
	 */
	hasTopic: (input: Pick<LimiterTopicConfig, 'key'>) => Promise<boolean>;

	/**
	 * Evaluates whether an identifier can consume a token for a topic.
	 */
	check: (input: LimiterTopicRequest) => Promise<LimiterResult>;

	/**
	 * Consumes a token and returns limiter data without throwing on exhaustion.
	 */
	consume: (input: LimiterTopicRequest) => Promise<LimiterResult>;

	/**
	 * Enforces a limit check and throws or runs a handler when limited.
	 */
	authorize: (input: LimiterAuthorizeRequest) => Promise<void>;
}

/**
 * Typed limiter service API.
 */
export interface LimiterService<
	KnownLimiters extends Record<string, LimiterDriver>,
	DefaultKey extends keyof KnownLimiters,
> {
	/**
	 * Returns the configured default limiter driver.
	 */
	default: () => KnownLimiters[DefaultKey];

	/**
	 * Returns a limiter driver by key.
	 */
	use: <Key extends keyof KnownLimiters>(driver: Key) => KnownLimiters[Key];
}
