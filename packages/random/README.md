# @lagomkit/random

Small, typed random generation toolkit with composable drivers and a lightweight service factory.

## Install

```bash
npm install @lagomkit/random
```

## Quick start

```ts
import {
	createRandomGeneratorService,
	createRandomStringDriver,
	createRandomTokenDriver,
	createRandomUuidDriver,
} from '@lagomkit/random';

const random = createRandomGeneratorService({
	default: 'string',
	drivers: {
		string: createRandomStringDriver({ length: 16 }),
		token: createRandomTokenDriver({ length: 6 }),
		uuid: createRandomUuidDriver(),
	},
});

const value = random.default().generate();
const token = random.use('token').generate({ length: 8 });
const id = random.use('uuid').generate();
```

## API

### `createRandomGeneratorService(config)`

Creates a random generator service with typed driver access.

- `config.default`: default driver key
- `config.drivers`: map of random generator drivers

Returned methods:

- `default()` returns the default driver
- `use(key)` returns a specific driver

### `createRandomStringDriver(config?)`

- `config.length` default output length (default: `16`)
- `generate({ length? })` returns a random hex string

### `createRandomTokenDriver(config?)`

- `config.length` default output length (default: `6`)
- `generate({ length? })` returns a numeric token string

### `createRandomUuidDriver()`

- `generate()` returns a UUID v4 string

## Notes

- All generators use Web Crypto APIs from `globalThis.crypto`.
- `length` values must be positive integers.
