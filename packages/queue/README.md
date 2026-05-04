# @lagomkit/queue

Type-safe queue service based on `pg-boss` for declaring tasks once and getting fully typed `send(...)`, `fetch(...)`, and `work(...)` flows.

`@lagomkit/queue` wraps `pg-boss` with a task-declaration API where each task owns its payload type and worker handler. Start the service and workers can register automatically.

## Why

- declare task payload and worker logic in one place
- get task-name and payload autocomplete from `send({ task, data })`
- auto-register workers on `start()` (or opt out with `autoWork: false`)
- auto-create declared queues before workers start polling them
- still access the raw `pg-boss` client through `client()`

## Quick start

```ts
import { createQueueService, defineTask } from '@lagomkit/queue';

const queueService = createQueueService({
  connectionString: process.env.DATABASE_URL!,
	tasks: {
		'email.sendWelcome': defineTask<{
			userId: string;
			locale?: 'en' | 'de';
		}>({
			name: 'queues.email.sendWelcome',
			options: { pollingIntervalSeconds: 5 },
			handler: async ([job]) => {
				job.data.userId;
			},
		}),
		'billing.syncInvoice': defineTask<{ invoiceId: string; force?: boolean }>({
			schedule: {
				cron: '0 * * * *',
				options: { key: 'billing-hourly' },
			},
			handler: async ([job]) => {
				job.data.invoiceId;
			},
		}),
	},
});

await queueService.start();

await queueService.send({
	task: 'email.sendWelcome',
	data: { userId: 'usr_1', locale: 'en' },
});

// Optional when autoWork is enabled (default)
await queueService.work('email.sendWelcome');

await queueService.stop();
```

## API

### `defineTask<Data>({ name?, options?, schedule?, handler })`

Creates a task declaration used for payload inference and worker registration.

- `name`: optional queue name override (falls back to task map key)
- `options`: optional `WorkOptions`
- `schedule`: optional cron schedule string or schedule config `{ cron, data?, options? }`
- `handler`: required worker handler

### `createQueueService(config)`

Creates a typed pg-boss service.

- `config.boss`: optional existing `pg-boss` client instance
- `config.connectionString`: postgres connection string for internal pg-boss creation
- `config.options`: pg-boss constructor options for internal pg-boss creation
- `config.tasks`: map of declared tasks
- `config.autoWork`: optional, defaults to `true`; auto-registers all declared workers in `start()`

Returned methods:

- `start()` starts the underlying pg-boss client
- `stop(options?)` stops the underlying pg-boss client
- `client()` returns the underlying pg-boss client
- `send({ task, data, options })` sends a typed job
- `sendAfter({ task, data, options, value })` sends a deferred typed job
- `sendThrottled({ task, data, options, seconds, key })` sends a throttled typed job
- `sendDebounced({ task, data, options, seconds, key })` sends a debounced typed job
- `fetch(task, options?)` fetches typed jobs
- `work(task)` registers a declared task worker from `defineTask`

## Notes

- Task names are validated at runtime and throw when unknown.
- Payload types are inferred from `defineTask<Data>({ ... })` declarations.
- Workers can auto-start on `start()` when `autoWork` is not `false`.
- Declared queues are created automatically before `work()` registers a worker.
- This package is intentionally thin and delegates behavior to `pg-boss`.
