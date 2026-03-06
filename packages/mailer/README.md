# @lagomkit/mailer

Small, typed mail delivery toolkit with composable drivers and a lightweight service factory.

## Quick start

```ts
import { createMailerService, createSmtpMailerDriver } from '@lagomkit/mailer';

const mailer = createMailerService({
	default: 'smtp',
	drivers: {
		smtp: createSmtpMailerDriver({
			host: 'smtp.example.com',
			port: 587,
			secure: false,
			auth: {
				user: 'smtp-user',
				pass: 'smtp-password',
			},
		}),
	},
});

await mailer.default().send({
	from: 'noreply@example.com',
	to: 'hello@example.com',
	subject: 'Welcome',
	text: 'Hello world',
});
```

## API

### `createMailerService(config)`

Creates a mailer service with typed driver access.

- `config.default`: default driver key
- `config.drivers`: a map of mailer drivers

Returned methods:

- `default()` returns the default driver
- `use(key)` returns a specific driver

### `createSmtpMailerDriver(config)`

SMTP mailer driver backed by Nodemailer.

- `config` is a Nodemailer `SMTPTransport.Options` object
- `send(message)` sends an email using `nodemailer` transport

## Notes

- SMTP delivery behavior depends on your provider configuration.
- Driver methods return promises; always `await` `send(...)`.
