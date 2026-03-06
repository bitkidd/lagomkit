import type { MailerDriverContract, MailerServiceContract } from './types.js';

/**
 * Creates a mailer service from a typed driver map.
 *
 * @param config.default Driver key used by `default()`.
 * @param config.drivers Available mailer drivers.
 */
export function createMailerService<
	KnownMailers extends Record<string, MailerDriverContract>,
>(config: {
	default: keyof KnownMailers;
	drivers: KnownMailers;
}): MailerServiceContract<KnownMailers> {
	return {
		default: () => {
			const driver = config.drivers[config.default];

			if (!driver) {
				throw new Error(
					`Mailer driver "${String(config.default)}" not defined`,
				);
			}

			return driver;
		},
		use: <T extends keyof KnownMailers>(driver: T): KnownMailers[T] => {
			const found = config.drivers[driver];

			if (!found) {
				throw new Error(`Mailer driver "${String(driver)}" is not defined`);
			}

			return found;
		},
	};
}
