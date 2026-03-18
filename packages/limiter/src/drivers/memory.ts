import * as v from 'valibot';
import type { LimiterDriverContract } from '../types.js';
import {
	parseLimiterMemoryDriverConfig,
	validateNonEmptyString,
	type LimiterMemoryDriverConfig,
} from '../helpers.js';

type LimiterTopic = {
	limit: number;
	period: number;
	usage: Map<string, number[]>;
};

type ResolvedConfig = {
	limit: number;
	period: number;
	onException: (() => void) | undefined;
	cleanupInterval: number;
};

function pruneTimestamps(
	timestamps: number[],
	now: number,
	periodInSeconds: number,
): number[] {
	const threshold = now - periodInSeconds * 1000;
	return timestamps.filter((timestamp) => timestamp >= threshold);
}

function resolveCheckResult(params: {
	limit: number;
	period: number;
	now: number;
	recent: number[];
	limited: boolean;
}): {
	limited: boolean;
	remaining: number;
	resetAt: number;
	retryAfter: number;
} {
	const oldest = params.recent[0] ?? params.now;
	const resetAt = oldest + params.period * 1000;

	if (params.limited) {
		return {
			limited: true,
			remaining: 0,
			resetAt,
			retryAfter: Math.max(0, Math.ceil((resetAt - params.now) / 1000)),
		};
	}

	return {
		limited: false,
		remaining: Math.max(0, params.limit - params.recent.length),
		resetAt,
		retryAfter: 0,
	};
}

export function createMemoryLimiterDriver(
	config?: LimiterMemoryDriverConfig,
): LimiterDriverContract {
	const topics = new Map<string, LimiterTopic>();
	const parsed = parseLimiterMemoryDriverConfig(config ?? {});
	const resolvedConfig: ResolvedConfig = {
		...{
			limit: 100,
			period: 60,
			onException: undefined,
			cleanupInterval: 30,
		},
		...parsed,
	};

	const cleanup: LimiterDriverContract['cleanup'] = async ({ topic } = {}) => {
		const now = Date.now();
		let removedTimestamps = 0;
		const targetTopics = topic ? [[topic, topics.get(topic)] as const] : topics;

		for (const [, foundTopic] of targetTopics) {
			if (!foundTopic) {
				continue;
			}

			for (const [identifier, timestamps] of foundTopic.usage) {
				const recent = pruneTimestamps(timestamps, now, foundTopic.period);
				removedTimestamps += timestamps.length - recent.length;

				if (recent.length === 0) {
					foundTopic.usage.delete(identifier);
					continue;
				}

				foundTopic.usage.set(identifier, recent);
			}
		}

		return removedTimestamps;
	};

	const interval = setInterval(() => {
		void cleanup();
	}, resolvedConfig.cleanupInterval * 1000);
	interval.unref?.();

	const check: LimiterDriverContract['check'] = async ({
		topic,
		identifier,
	}) => {
		validateNonEmptyString(topic, 'topic');
		validateNonEmptyString(identifier, 'identifier');

		const now = Date.now();
		const foundTopic = topics.get(topic);

		if (!foundTopic) {
			throw new Error(`Topic not found: ${topic}`);
		}

		const recent = pruneTimestamps(
			foundTopic.usage.get(identifier) ?? [],
			now,
			foundTopic.period,
		);

		if (recent.length >= foundTopic.limit) {
			foundTopic.usage.set(identifier, recent);
			return resolveCheckResult({
				limit: foundTopic.limit,
				period: foundTopic.period,
				now,
				recent,
				limited: true,
			});
		}

		recent.push(now);
		foundTopic.usage.set(identifier, recent);

		return resolveCheckResult({
			limit: foundTopic.limit,
			period: foundTopic.period,
			now,
			recent,
			limited: false,
		});
	};

	return {
		check,
		cleanup,
		authorize: async ({ topic, identifier, onException }) => {
			const result = await check({ topic, identifier });
			const handler = onException ?? resolvedConfig.onException;

			if (result.limited) {
				if (!handler) {
					throw new Error('You are not allowed to perform this action');
				}

				handler();
			}
		},
		hasTopic: async ({ key }) => {
			validateNonEmptyString(key, 'topic');
			return topics.has(key);
		},
		getTopic: async ({ key }) => {
			validateNonEmptyString(key, 'topic');
			const found = topics.get(key);
			if (!found) return null;
			return {
				...found,
				usage: new Map(found.usage),
			};
		},
		createTopic: async ({ key, limit, period }) => {
			validateNonEmptyString(key, 'topic');

			const resolvedLimit = v.parse(
				v.pipe(v.number(), v.minValue(0.0001, 'limit must be greater than 0')),
				limit ?? resolvedConfig.limit,
			);
			const resolvedPeriod = v.parse(
				v.pipe(v.number(), v.minValue(0.0001, 'period must be greater than 0')),
				period ?? resolvedConfig.period,
			);

			if (!topics.has(key)) {
				topics.set(key, {
					limit: resolvedLimit,
					period: resolvedPeriod,
					usage: new Map(),
				});
			}
		},
		hasExceptionHandler: () => {
			return !!resolvedConfig.onException;
		},
		setExceptionHandler: (newExceptionHandler: () => void) => {
			resolvedConfig.onException = newExceptionHandler;
		},
		destroy: () => {
			clearInterval(interval);
		},
	};
}
