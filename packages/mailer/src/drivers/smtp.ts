import type Mail from 'nodemailer/lib/mailer/index.js';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import type { MailerDriverContract } from '#src/types.js';

import nodemailer from 'nodemailer';

/**
 * Creates an SMTP mailer driver backed by Nodemailer.
 *
 * @param config Nodemailer SMTP transport options.
 */
export function createSmtpMailerDriver(
	config: SMTPTransport.Options,
): MailerDriverContract {
	const client = nodemailer.createTransport(config);

	return {
		send: async (args: Mail.Options): Promise<void> => {
			await client.sendMail(args);
		},
	};
}
