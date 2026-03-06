export interface LimiterDriverContract {
	hasExceptionHandler: () => boolean;
	setExceptionHandler: (newExceptionHandler: () => void) => void;
	cleanup: (params?: { topic?: string }) => Promise<number>;
	destroy?: () => void;
	createTopic: (params: {
		key: string;
		limit?: number;
		period?: number;
	}) => Promise<void>;
	getTopic: (params: { key: string }) => Promise<{
		limit: number;
		period: number;
		usage: Map<string, number[]>;
	} | null>;
	hasTopic: (params: { key: string }) => Promise<boolean>;
	check: (params: { topic: string; identifier: string }) => Promise<{
		limited: boolean;
		remaining: number;
		resetAt: number;
		retryAfter: number;
	}>;
	authorize: (params: {
		topic: string;
		identifier: string;
		onException?: () => void;
	}) => Promise<void>;
}

export interface LimiterServiceContract<
	KnownLimiters extends Record<string, LimiterDriverContract>,
> {
	default: () => LimiterDriverContract;
	use: <Key extends keyof KnownLimiters>(driver: Key) => KnownLimiters[Key];
}
