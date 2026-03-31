import type {
	LimiterDriver,
	LimiterDriverConfig,
	LimiterTopic,
	LimiterTopicConfig,
} from '../types.js';

import {
	LimiterExceededError,
	TopicExistsError,
	TopicNotFoundError,
} from '../helpers.js';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';

const DEFAULT_LIMIT = 100;
const DEFAULT_PERIOD = 60;
const DEFAULT_KEY_PREFIX = 'rlflx';

type TopicRecord = {
	topic: LimiterTopic;
	limiter: RateLimiterMemory;
};

function assertNonEmptyString(value: string, name: string): void {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`${name} must be a non-empty string`);
	}
}

function assertPositiveInteger(value: number, name: string): void {
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`${name} must be greater than 0`);
	}
}

function toRateLimiterRes(error: unknown): RateLimiterRes | null {
	if (error instanceof RateLimiterRes) {
		return error;
	}

	if (
		typeof error === 'object' &&
		error !== null &&
		'msBeforeNext' in error &&
		'remainingPoints' in error &&
		'consumedPoints' in error
	) {
		const result = error as {
			msBeforeNext: number;
			remainingPoints: number;
			consumedPoints: number;
			isFirstInDuration?: boolean;
		};

		return new RateLimiterRes(
			result.remainingPoints,
			result.msBeforeNext,
			result.consumedPoints,
			result.isFirstInDuration ?? false,
		);
	}

	return null;
}

function createTopicLimiter(
	baseConfig: {
		limit: number;
		period: number;
		keyPrefix: string;
		blockDuration?: number;
		execEvenly?: boolean;
		execEvenlyMinDelayMs?: number;
	},
	topicConfig: LimiterTopic,
): RateLimiterMemory {
	const options: {
		points: number;
		duration: number;
		keyPrefix: string;
		blockDuration?: number;
		execEvenly?: boolean;
		execEvenlyMinDelayMs?: number;
	} = {
		points: topicConfig.limit,
		duration: topicConfig.period,
		keyPrefix: `${baseConfig.keyPrefix}:${topicConfig.key}`,
	};

	if (baseConfig.blockDuration !== undefined) {
		options.blockDuration = baseConfig.blockDuration;
	}

	if (baseConfig.execEvenly !== undefined) {
		options.execEvenly = baseConfig.execEvenly;
	}

	if (baseConfig.execEvenlyMinDelayMs !== undefined) {
		options.execEvenlyMinDelayMs = baseConfig.execEvenlyMinDelayMs;
	}

	return new RateLimiterMemory(options);
}

export function createMemoryLimiterDriver(
	config: LimiterDriverConfig = {},
): LimiterDriver {
	const baseConfig: {
		limit: number;
		period: number;
		keyPrefix: string;
		blockDuration?: number;
		execEvenly?: boolean;
		execEvenlyMinDelayMs?: number;
	} = {
		limit: config.limit ?? DEFAULT_LIMIT,
		period: config.period ?? DEFAULT_PERIOD,
		keyPrefix: config.keyPrefix ?? DEFAULT_KEY_PREFIX,
	};

	if (config.blockDuration !== undefined) {
		baseConfig.blockDuration = config.blockDuration;
	}

	if (config.execEvenly !== undefined) {
		baseConfig.execEvenly = config.execEvenly;
	}

	if (config.execEvenlyMinDelayMs !== undefined) {
		baseConfig.execEvenlyMinDelayMs = config.execEvenlyMinDelayMs;
	}

	assertPositiveInteger(baseConfig.limit, 'limit');
	assertPositiveInteger(baseConfig.period, 'period');

	const topics = new Map<string, TopicRecord>();

	const getTopicRecord = (topicKey: string): TopicRecord => {
		assertNonEmptyString(topicKey, 'topic');

		const found = topics.get(topicKey);

		if (!found) {
			throw new TopicNotFoundError(topicKey);
		}

		return found;
	};

	const createTopic: LimiterDriver['createTopic'] = async (
		topicConfig: LimiterTopicConfig,
	) => {
		assertNonEmptyString(topicConfig.key, 'topic');

		if (topics.has(topicConfig.key)) {
			throw new TopicExistsError(topicConfig.key);
		}

		const topic: LimiterTopic = {
			key: topicConfig.key,
			limit: topicConfig.limit ?? baseConfig.limit,
			period: topicConfig.period ?? baseConfig.period,
		};

		assertPositiveInteger(topic.limit, 'limit');
		assertPositiveInteger(topic.period, 'period');

		topics.set(topic.key, {
			topic,
			limiter: createTopicLimiter(baseConfig, topic),
		});

		return { ...topic };
	};

	const getTopic: LimiterDriver['getTopic'] = async ({ key }) => {
		assertNonEmptyString(key, 'topic');

		const found = topics.get(key);

		return found ? { ...found.topic } : null;
	};

	const hasTopic: LimiterDriver['hasTopic'] = async ({ key }) => {
		assertNonEmptyString(key, 'topic');
		return topics.has(key);
	};

	const check: LimiterDriver['check'] = async ({ topic, identifier }) => {
		assertNonEmptyString(identifier, 'identifier');

		const record = getTopicRecord(topic);
		const current = await record.limiter.get(identifier);

		if (!current) {
			return {
				ok: true,
				data: new RateLimiterRes(record.topic.limit, 0, 0, true),
			};
		}

		return {
			ok: current.remainingPoints > 0,
			data: current,
		};
	};

	const consume: LimiterDriver['consume'] = async ({ topic, identifier }) => {
		assertNonEmptyString(identifier, 'identifier');

		const record = getTopicRecord(topic);

		try {
			const result = await record.limiter.consume(identifier);

			return { ok: true, data: result };
		} catch (error) {
			const result = toRateLimiterRes(error);

			if (!result) {
				throw error;
			}

			return { ok: false, data: result };
		}
	};

	const authorize: LimiterDriver['authorize'] = async ({
		topic,
		identifier,
		onException,
	}) => {
		const result = await consume({ topic, identifier });

		if (result.ok) {
			return;
		}

		const handler = onException ?? config.onException;

		if (handler) {
			handler(result.data);
			return;
		}

		throw new LimiterExceededError(result.data);
	};

	return {
		createTopic,
		getTopic,
		hasTopic,
		check,
		consume,
		authorize,
	};
}
