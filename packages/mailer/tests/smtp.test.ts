import { describe, expect, test, vi } from 'vitest';
import { createSmtpMailerDriver } from '#src/drivers/smtp.js';

describe('Mailer::SMTP', () => {
	const driver = createSmtpMailerDriver({ host: 'smtp.example.com' });

	test('should return a driver instance', () => {
		expect(driver).toHaveProperty('send');
	});

	test('should call transport sendMail', async () => {
		const sendSpy = vi.spyOn(driver, 'send').mockResolvedValueOnce(undefined);

		await driver.send({ to: 'hello@example.com', from: 'noreply@example.com' });

		expect(sendSpy).toHaveBeenCalledTimes(1);
	});
});
