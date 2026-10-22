import nodemailer from 'nodemailer';
import { describe, expect, test, vi } from 'vitest';
import { createSmtpMailerDriver } from '#src/drivers/smtp.js';

describe('Mailer::SMTP', { concurrent: false }, () => {
	const driver = createSmtpMailerDriver({ host: 'smtp.example.com' });

	test('should return a driver instance', () => {
		expect(driver).toHaveProperty('send');
	});

	test('should call transport sendMail', async () => {
		const transport = nodemailer.createTransport({ jsonTransport: true });
		const sendSpy = vi.spyOn(transport, 'sendMail');
		const transportSpy = vi
			.spyOn(nodemailer, 'createTransport')
			.mockReturnValueOnce(transport);
		const config = { host: 'smtp.example.com' };
		const message = {
			to: 'hello@example.com',
			from: 'noreply@example.com',
			text: 'Hello from LagomKit',
		};

		try {
			const smtpDriver = createSmtpMailerDriver(config);
			await expect(smtpDriver.send(message)).resolves.toBeUndefined();

			expect(transportSpy).toHaveBeenCalledWith(config);
			expect(sendSpy).toHaveBeenCalledExactlyOnceWith(message);
		} finally {
			transportSpy.mockRestore();
		}
	});

	test('should propagate transport errors', async () => {
		const transport = nodemailer.createTransport({ jsonTransport: true });
		const error = new Error('SMTP delivery failed');
		vi.spyOn(transport, 'sendMail').mockRejectedValueOnce(error);
		const transportSpy = vi
			.spyOn(nodemailer, 'createTransport')
			.mockReturnValueOnce(transport);

		try {
			const smtpDriver = createSmtpMailerDriver({ host: 'smtp.example.com' });
			await expect(
				smtpDriver.send({
					to: 'hello@example.com',
					from: 'noreply@example.com',
				}),
			).rejects.toBe(error);
		} finally {
			transportSpy.mockRestore();
		}
	});
});
