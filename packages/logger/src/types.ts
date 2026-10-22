/**
 * Log levels ordered from the most detailed to the most severe.
 */
export type LoggerLevel =
	| 'trace'
	| 'debug'
	| 'info'
	| 'warn'
	| 'error'
	| 'fatal';

/**
 * Structured fields attached to a message. Use JSON-serializable values for Axiom.
 */
export type LoggerContext = Record<string, unknown>;

/**
 * Message accepted by each level-specific logging method.
 */
export type LoggerMessage = {
	message: string;
	context?: LoggerContext;
	error?: unknown;
};

/**
 * Message with an explicit severity, accepted by `log()`.
 */
export type LoggerEntry = LoggerMessage & {
	level: LoggerLevel;
};

/**
 * Configuration shared by logger drivers.
 */
export type LoggerDriverConfig = {
	/**
	 * Minimum severity to emit. Defaults to `info`.
	 */
	level?: LoggerLevel;
	/**
	 * Default context fields. Message context takes precedence on matching keys.
	 */
	context?: LoggerContext;
};

/**
 * Contract implemented by all logger drivers. Methods write locally or queue
 * messages for background delivery without blocking the caller.
 */
export interface LoggerDriverContract {
	log: (entry: LoggerEntry) => void;
	trace: (message: LoggerMessage) => void;
	debug: (message: LoggerMessage) => void;
	info: (message: LoggerMessage) => void;
	warn: (message: LoggerMessage) => void;
	error: (message: LoggerMessage) => void;
	fatal: (message: LoggerMessage) => void;
}

/**
 * Typed logger service API.
 */
export interface LoggerServiceContract<
	KnownLoggers extends Record<string, LoggerDriverContract>,
> {
	/**
	 * Returns the configured default logger driver.
	 */
	default: () => LoggerDriverContract;
	/**
	 * Returns a logger driver by key, preserving its concrete type.
	 */
	use: <Key extends keyof KnownLoggers>(driver: Key) => KnownLoggers[Key];
}
