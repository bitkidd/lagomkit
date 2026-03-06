import { describe, expect, test, vi } from 'vitest';
import { createSmtpMailerDriver } from '../src/drivers/smtp.js';

describe('Mailer::SMTP', () => {
	const sendMail = vi.fn(async () => {
		return undefined;
	});
	const driver = createSmtpMailerDriver(
		{ host: 'smtp.example.com' },
		{
			nodemailer: {
				createTransport: () => ({ sendMail }),
			},
		},
	);

	test('should return a driver instance', () => {
		expect(driver).toHaveProperty('send');
	});

	test('should call transport sendMail', async () => {
		await driver.send({ to: 'hello@example.com', from: 'noreply@example.com' });

		expect(sendMail).toHaveBeenCalledTimes(1);
	});
});
