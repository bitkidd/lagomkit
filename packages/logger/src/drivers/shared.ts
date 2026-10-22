import type {
	LoggerDriverConfig,
	LoggerDriverContract,
	LoggerEntry,
	LoggerLevel,
} from '../types.js';

const LEVEL_PRIORITIES: Record<LoggerLevel, number> = {
	trace: 0,
	debug: 1,
	info: 2,
	warn: 3,
	error: 4,
	fatal: 5,
};

function assertLoggerLevel(level: LoggerLevel): void {
	if (!Object.hasOwn(LEVEL_PRIORITIES, level)) {
		throw new Error(`Logger level "${String(level)}" is not defined`);
	}
}

/**
 * Keeps filtering, context merging, and convenience methods consistent between
 * backends. Writers receive only messages that meet the configured threshold.
 */
export function createLoggerDriver(
	config: LoggerDriverConfig & {
		write: (entry: LoggerEntry) => void;
	},
): LoggerDriverContract {
	const level = config.level ?? 'info';
	assertLoggerLevel(level);

	const context = config.context ? { ...config.context } : undefined;

	const log = (entry: LoggerEntry): void => {
		assertLoggerLevel(entry.level);

		if (LEVEL_PRIORITIES[entry.level] < LEVEL_PRIORITIES[level]) {
			return;
		}

		config.write({
			...entry,
			...(context || entry.context
				? { context: { ...context, ...entry.context } }
				: {}),
		});
	};

	return {
		log,
		trace: (message) => {
			log({ ...message, level: 'trace' });
		},
		debug: (message) => {
			log({ ...message, level: 'debug' });
		},
		info: (message) => {
			log({ ...message, level: 'info' });
		},
		warn: (message) => {
			log({ ...message, level: 'warn' });
		},
		error: (message) => {
			log({ ...message, level: 'error' });
		},
		fatal: (message) => {
			log({ ...message, level: 'fatal' });
		},
	};
}
