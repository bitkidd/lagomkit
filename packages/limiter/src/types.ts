/**
 * Contract implemented by limiter drivers.
 */
export interface LimiterDriverContract {
	/**
	 * Returns whether a fallback exception handler is configured.
	 */
	hasExceptionHandler: () => boolean;
	/**
	 * Sets a fallback exception handler used by `authorize`.
	 */
	setExceptionHandler: (newExceptionHandler: () => void) => void;
	/**
	 * Removes stale usage timestamps.
	 *
	 * @returns Number of removed timestamps.
	 */
	cleanup: (params?: { topic?: string }) => Promise<number>;
	/**
	 * Optional teardown hook for driver resources.
	 */
	destroy?: () => void;
	/**
	 * Creates a limiter topic if it does not already exist.
	 */
	createTopic: (params: {
		key: string;
		limit?: number;
		period?: number;
	}) => Promise<void>;
	/**
	 * Returns topic configuration and usage state.
	 */
	getTopic: (params: { key: string }) => Promise<{
		limit: number;
		period: number;
		usage: Map<string, number[]>;
	} | null>;
	/**
	 * Returns whether a topic exists.
	 */
	hasTopic: (params: { key: string }) => Promise<boolean>;
	/**
	 * Evaluates whether an identifier is currently limited for a topic.
	 */
	check: (params: { topic: string; identifier: string }) => Promise<{
		limited: boolean;
		remaining: number;
		resetAt: number;
		retryAfter: number;
	}>;
	/**
	 * Enforces a limit check and throws or runs a handler when limited.
	 */
	authorize: (params: {
		topic: string;
		identifier: string;
		onException?: () => void;
	}) => Promise<void>;
}

/**
 * Typed limiter service API.
 */
export interface LimiterServiceContract<
	KnownLimiters extends Record<string, LimiterDriverContract>,
> {
	/**
	 * Returns the configured default limiter driver.
	 */
	default: () => LimiterDriverContract;
	/**
	 * Returns a limiter driver by key.
	 */
	use: <Key extends keyof KnownLimiters>(driver: Key) => KnownLimiters[Key];
}
