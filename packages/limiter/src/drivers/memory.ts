import type { LimiterDriverContract } from '../types.js';

/**
 * Configuration for the in-memory limiter driver.
 */
export type LimiterMemoryDriverConfig = {
	limit?: number;
	period?: number;
	onException?: () => void;
	cleanupInterval?: number;
};

type LimiterMemoryDriverResolvedConfig = {
	limit: number;
	period: number;
	onException: (() => void) | undefined;
	cleanupInterval: number;
};

type LimiterTopic = {
	limit: number;
	period: number;
	usage: Map<string, number[]>;
};

function ensureNonEmpty(value: string, label: string): void {
	if (!value.trim()) {
		throw new Error(`Limiter ${label} must be a non-empty string`);
	}
}

function ensurePositive(value: number, label: string): void {
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`Limiter ${label} must be greater than 0`);
	}
}

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

/**
 * Creates an in-memory limiter driver.
 *
 * @param config.limit Default max requests per topic window.
 * @param config.period Default window length in seconds.
 * @param config.onException Fallback handler for unauthorized calls.
 * @param config.cleanupInterval Background stale-entry cleanup interval in seconds.
 */
export function createMemoryLimiterDriver(
	config?: LimiterMemoryDriverConfig,
): LimiterDriverContract {
	const topics = new Map<string, LimiterTopic>();
	const resolvedConfig: LimiterMemoryDriverResolvedConfig = {
		limit: 100,
		period: 60,
		onException: undefined,
		cleanupInterval: 30,
		...config,
	};

	ensurePositive(resolvedConfig.limit, 'limit');
	ensurePositive(resolvedConfig.period, 'period');
	ensurePositive(resolvedConfig.cleanupInterval, 'cleanup interval');

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
		ensureNonEmpty(topic, 'topic');
		ensureNonEmpty(identifier, 'identifier');

		const now = Date.now();
		const foundTopic = topics.get(topic);

		if (!foundTopic) {
			throw new Error(`Topic not found: ${topic}`);
		}

		const { limit, period, usage } = foundTopic;
		const recent = pruneTimestamps(usage.get(identifier) ?? [], now, period);

		if (recent.length >= limit) {
			usage.set(identifier, recent);
			return resolveCheckResult({
				limit,
				period,
				now,
				recent,
				limited: true,
			});
		}

		recent.push(now);
		usage.set(identifier, recent);

		return resolveCheckResult({
			limit,
			period,
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
			ensureNonEmpty(key, 'topic');
			return topics.has(key);
		},
		getTopic: async ({ key }) => {
			ensureNonEmpty(key, 'topic');
			return topics.get(key) ?? null;
		},
		createTopic: async ({ key, limit, period }) => {
			ensureNonEmpty(key, 'topic');

			const resolvedLimit = limit ?? resolvedConfig.limit;
			const resolvedPeriod = period ?? resolvedConfig.period;

			ensurePositive(resolvedLimit, 'limit');
			ensurePositive(resolvedPeriod, 'period');

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
