# @lagomkit/logger

Small, typed structured logging toolkit with composable drivers and a lightweight service factory.

## Install

```bash
pnpm add @lagomkit/logger
```

## Quick start

```ts
import {
	createConsolaLoggerDriver,
	createLoggerService,
} from '@lagomkit/logger';

const logger = createLoggerService({
	default: 'local',

	drivers: {
		local: createConsolaLoggerDriver({
			level: 'debug',
			context: { service: 'api' },
			options: {
				defaults: { tag: 'api' },
			},
		}),
	},
});

logger.default().info({
	message: 'Server started',
	context: { port: 3000 },
});

logger.use('local').error({
	message: 'Request failed',
	context: { requestId: 'req_123' },
	error: new Error('Database unavailable'),
});
```

## Axiom

```ts
import {
	createAxiomLoggerDriver,
	createConsolaLoggerDriver,
	createLoggerService,
} from '@lagomkit/logger';

const logger = createLoggerService({
	default: 'remote',

	drivers: {
		local: createConsolaLoggerDriver(),
		remote: createAxiomLoggerDriver({
			dataset: 'app-logs',
			level: 'info',
			context: { service: 'api', environment: 'production' },
			options: {
				token: process.env.AXIOM_TOKEN!,
				// Set the edge domain for your dataset's region when needed.
				edge: 'eu-central-1.aws.edge.axiom.co',
			},
			onError: (error) => {
				console.error('Log delivery failed', error);
			},
		}),
	},
});

logger.default().info({
	message: 'Order created',
	context: { orderId: 'ord_123' },
});
```

All log methods return `void`. The Axiom driver starts each request in the background using the SDK's unbatched client, consumes rejected requests, and reports delivery failures through `onError` (default: `console.error`). It has no `flush()` method, batching timer, or shutdown hook. Delivery is best-effort: the application does not wait for pending logs before exiting.

An existing `AxiomWithoutBatching` client can be passed as `client` instead of `options`. Its own SDK error handler still applies; errors reaching the driver are passed to the driver's `onError` callback.

## API

### `createLoggerService(config)`

Creates a service with typed driver access:
- `config.default`: default driver key
- `config.drivers`: map of logger drivers
- `default()`: returns the default driver
- `use(key)`: returns a specific driver, preserving its concrete type

### Common driver methods

Both drivers implement `LoggerDriverContract`:

```ts
driver.trace({ message: 'Request details', context: { requestId: 'req_123' } });
driver.debug({ message: 'Cache lookup' });
driver.info({ message: 'Ready' });
driver.warn({ message: 'Retrying' });
driver.error({ message: 'Failed', error: new Error('Connection refused') });
driver.fatal({ message: 'Service unavailable' });

driver.log({ level: 'info', message: 'Explicit severity' });
```

Each method accepts a required `message`, optional `context`, and optional `error`. `error` accepts any thrown value. `fatal()` records a message; it does not exit the process.

### Shared configuration

- `level`: minimum severity to emit, default `info`
- `context`: default structured fields; per-message context overrides matching keys with a shallow merge

Levels run from least to most severe: `trace`, `debug`, `info`, `warn`, `error`, `fatal`. For example, `level: 'warn'` emits warnings, errors, and fatal messages.

### `createConsolaLoggerDriver(config?)`

Creates a separate Consola instance with pretty terminal output and automatic fallback in CI. `options` accepts native Consola presentation options, including `fancy`, `defaults.tag`, `formatOptions`, and custom `reporters`. Severity filtering belongs to the shared driver, and repeat throttling is disabled so messages write immediately. The global console is untouched.

### `createAxiomLoggerDriver(config)`

- `dataset`: required non-empty dataset name
- `options`: Axiom SDK client options, including `token`, regional `edge`, and custom `fetch`
- `client`: existing unbatched Axiom client, as an alternative to `options`
- `onError`: optional callback for delivery failures; callback failures are contained as well

Events contain `_time` (ISO timestamp), `level`, `message`, and optional `context` and `error`. Context stays nested so its fields cannot overwrite event metadata. `Error` values supplied as `error` become `{ name, message, stack }`; other thrown values are preserved. Use JSON-serializable context and non-Error values. Serialization failures are reported through `onError`.

## Subpath imports

```ts
import { createLoggerService } from '@lagomkit/logger/service';
import { createConsolaLoggerDriver } from '@lagomkit/logger/drivers/consola';
import { createAxiomLoggerDriver } from '@lagomkit/logger/drivers/axiom';
import type { LoggerDriverContract } from '@lagomkit/logger/types';
```
