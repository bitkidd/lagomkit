# @lagomkit/limiter

Small, typed rate-limiting toolkit with composable drivers and a lightweight service factory.

## Quick start

```ts
import { createLimiterService, createMemoryLimiterDriver } from '@lagomkit/limiter';

const limiter = createLimiterService({
	default: 'memory',
	drivers: {
		memory: createMemoryLimiterDriver({
			limit: 5,
			period: 60,
		}),
	},
});

await limiter.default().createTopic({ key: 'login', limit: 3, period: 60 });

const result = await limiter.default().check({
	topic: 'login',
	identifier: 'user:42',
});

if (result.limited) {
	// deny request
}
```

## API

### `createLimiterService(config)`

Creates a limiter service with typed driver access.

- `config.default`: default driver key
- `config.drivers`: a map of limiter drivers

Returned methods:

- `default()` returns the default driver
- `use(key)` returns a specific driver

### `createMemoryLimiterDriver(config?)`

In-memory driver with topic-based limits.

Config options:

- `limit` default limit per topic (default: `100`)
- `period` default period in seconds (default: `60`)
- `onException` fallback unauthorized handler for `authorize`
- `cleanupInterval` background cleanup interval in seconds (default: `30`)

Driver methods:

- `createTopic({ key, limit?, period? })` creates a topic if it does not exist
- `getTopic({ key })` returns topic config and usage map, or `null` when missing
- `hasTopic({ key })` returns whether a topic exists
- `check({ topic, identifier })` returns `{ limited, remaining, resetAt, retryAfter }`
- `authorize({ topic, identifier, onException? })` throws or calls exception handler when limited
- `setExceptionHandler(handler)` sets fallback exception handler
- `hasExceptionHandler()` returns whether fallback handler is configured
- `cleanup({ topic? })` prunes stale usage entries and returns number of removed timestamps
- `destroy()` clears internal cleanup timer (call on shutdown in long-running apps)

## Notes

- In-memory state is process-local and resets when the process restarts.
- Use memory driver for single-process apps, tests, and local development.
