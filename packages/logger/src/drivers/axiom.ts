import { AxiomWithoutBatching, type ClientOptions } from '@axiomhq/js';
import type { LoggerDriverConfig, LoggerDriverContract } from '../types.js';
import { createLoggerDriver } from './shared.js';

/**
 * Minimal Axiom client surface used by the driver.
 */
export type AxiomLoggerClient = Pick<AxiomWithoutBatching, 'ingest'>;

/**
 * Uses either an existing Axiom client or SDK constructor options.
 */
export type AxiomLoggerDriverConfig = LoggerDriverConfig & {
	dataset: string;
	/**
	 * Receives background delivery errors. Defaults to `console.error`.
	 */
	onError?: (error: unknown) => void;
} & (
		| { client: AxiomLoggerClient }
		| { options: Omit<ClientOptions, 'onError'> }
	);

/**
 * Creates a structured Axiom logger. Requests start immediately in the background;
 * logging never waits for delivery or installs batching timers or shutdown hooks.
 */
export function createAxiomLoggerDriver(
	config: AxiomLoggerDriverConfig,
): LoggerDriverContract {
	if (config.dataset.trim().length === 0) {
		throw new Error('Axiom logger dataset must be a non-empty string');
	}

	const onError = config.onError ?? console.error;
	const reportError = (error: unknown): void => {
		try {
			onError(error);
		} catch {
			// A failing error handler must not produce an unhandled rejection or
			// interrupt application code for a best-effort log message.
		}
	};

	const client =
		'client' in config
			? config.client
			: new AxiomWithoutBatching({ ...config.options, onError: reportError });

	return createLoggerDriver({
		...config,
		write: (entry) => {
			// Error properties are non-enumerable, so JSON would otherwise discard
			// the message and stack. Keep context nested to protect event fields.
			const error =
				entry.error instanceof Error
					? {
							name: entry.error.name,
							message: entry.error.message,
							stack: entry.error.stack,
						}
					: entry.error;

			const event = {
				_time: new Date().toISOString(),
				level: entry.level,
				message: entry.message,
				...(entry.context !== undefined ? { context: entry.context } : {}),
				...(error !== undefined ? { error } : {}),
			};

			try {
				// The unbatched client starts delivery without retaining messages in
				// a timer-driven queue. Always consume rejected background requests.
				void client
					.ingest(config.dataset, event)
					.then((result) => {
						if (result.failed > 0) {
							reportError(
								new Error('Axiom logger failed to ingest the message'),
							);
						}
					})
					.catch(reportError);
			} catch (error) {
				reportError(error);
			}
		},
	});
}
