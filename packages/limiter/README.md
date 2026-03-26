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
await limiter.default().createTopic({ key: 'search' });

const result = await limiter.default().consume({
	topic: 'login',
	identifier: 'user:42',
});

if (!result.ok) {
	// deny request and inspect retry metadata
	console.log(result.data.msBeforeNext);
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
- `keyPrefix` optional storage prefix for internal limiter keys
- `blockDuration`, `execEvenly`, and `execEvenlyMinDelayMs` are forwarded to `rate-limiter-flexible`

Driver methods:

- `createTopic({ key, limit?, period? })` creates a topic and throws if it already exists
- `getTopic({ key })` returns topic config, or `null` when missing
- `hasTopic({ key })` returns whether a topic exists
- `check({ topic, identifier })` reads current limiter state without consuming a token
- `consume({ topic, identifier })` consumes a token and returns `{ ok, data }` without throwing on limit exhaustion
- `authorize({ topic, identifier, onException? })` consumes a token and throws or calls exception handler when limited

`data` is a `RateLimiterRes` from `rate-limiter-flexible`, so it includes values such as:

- `remainingPoints`
- `consumedPoints`
- `msBeforeNext`
- `isFirstInDuration`

## Notes

- In-memory state is process-local and resets when the process restarts.
- Use memory driver for single-process apps, tests, and local development.
- Topics must be explicitly created before use; unknown topics throw.
