import { createConsola } from 'consola';
import type { LoggerDriverConfig, LoggerDriverContract } from '../types.js';
import { createLoggerDriver } from './shared.js';

/**
 * Consola presentation options. Severity and throttling are managed by the driver.
 */
export type ConsolaLoggerDriverConfig = LoggerDriverConfig & {
	options?: Omit<
		NonNullable<Parameters<typeof createConsola>[0]>,
		'level' | 'throttle' | 'types'
	>;
};

/**
 * Creates an isolated Consola logger with pretty terminal output and automatic
 * fallback in CI. It does not replace the global console or redirect streams.
 */
export function createConsolaLoggerDriver(
	config: ConsolaLoggerDriverConfig = {},
): LoggerDriverContract {
	const client = createConsola({
		...config.options,
		// Filtering belongs to the shared driver. Disable delayed repeat summaries
		// so each call writes immediately without leaving pending log timers.
		level: 5,
		throttle: 0,
	});

	return createLoggerDriver({
		...config,
		write: (entry) => {
			const args: unknown[] = [entry.message];

			if (entry.context !== undefined) {
				args.push(entry.context);
			}

			if (entry.error !== undefined) {
				args.push(entry.error);
			}

			client[entry.level]({ args });
		},
	});
}
