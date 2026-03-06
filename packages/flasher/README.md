# @lagomkit/flasher

Small, typed flash-message toolkit with composable drivers and a lightweight service factory.

## Quick start

```ts
import { createFlasherService, createMemoryFlasherDriver } from '@lagomkit/flasher';

const flasher = createFlasherService({
	default: 'memory',
	drivers: {
		memory: createMemoryFlasherDriver(),
	},
});

const id = await flasher.default().set(
	{ kind: 'success', text: 'Saved successfully' },
	{ ttlMs: 5000 },
);

const message = await flasher.default().get<{ kind: string; text: string }>(id);
```

## API

### `createFlasherService(config)`

Creates a flasher service with typed driver access.

- `config.default`: default driver key
- `config.drivers`: a map of flasher drivers

Returned methods:

- `default()` returns the default driver
- `use(key)` returns a specific driver

### `createMemoryFlasherDriver()`

In-memory flash storage driver.

- `set(value, { ttlMs? })` stores a value and returns id
- `get(id)` reads and consumes value by id
- `peek(id)` reads value by id without consuming
- `getMany(ids)` reads and consumes many values
- `peekMany(ids)` reads many values without consuming
- `erase(id)` removes value by id
- `clear()` removes all stored values

## Notes

- In-memory state is process-local and resets when the process restarts.
- TTL is evaluated lazily on read operations.
