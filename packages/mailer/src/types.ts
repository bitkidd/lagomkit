import type Mail from 'nodemailer/lib/mailer/index.js';

/**
 * Contract implemented by mailer drivers.
 */
export interface MailerDriverContract {
	/**
	 * Sends an email message.
	 */
	send: (args: Mail.Options) => Promise<void>;
}

/**
 * Typed mailer service API.
 */
export interface MailerServiceContract<
	KnownMailers extends Record<string, MailerDriverContract>,
> {
	/**
	 * Returns the configured default mailer driver.
	 */
	default: () => MailerDriverContract;
	/**
	 * Returns a mailer driver by key.
	 */
	use: <Key extends keyof KnownMailers>(driver: Key) => KnownMailers[Key];
}
