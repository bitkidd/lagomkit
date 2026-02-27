# @lagomkit/encoder

Small, typed encoding toolkit with composable drivers and a lightweight service factory.

## Install

```bash
npm install @lagomkit/encoder
```

## Quick start

```ts
import {
  createEncoderService,
  createBase64Driver,
  createBase64UrlDriver,
  createHexDriver,
} from '@lagomkit/encoder';

const encoder = createEncoderService({
  default: 'base64',
  drivers: {
    base64: createBase64Driver(),
    base64url: createBase64UrlDriver(),
    hex: createHexDriver(),
  },
});

const bytes = new TextEncoder().encode('hello world');

const base64 = encoder.default().encode({ data: bytes });
const roundtrip = encoder.use('base64').decode({ data: base64 });
```

## API

### `createEncoderService(config)`

Creates an encoder service with typed driver access.

- `config.default`: the default driver key
- `config.drivers`: a map of driver instances

Returned methods:

- `default()` returns the default driver
- `use(key)` returns a specific driver

### Driver contract

All driver factories return an `EncoderDriver`:

```ts
type EncoderDriver = {
  encode(input: {
    data: Uint8Array;
    options?: { includePadding?: boolean };
  }): string;
  decode(input: { data: string }): Uint8Array;
};
```

## Driver factories

- `createBase32Driver()`
- `createBase64Driver()`
- `createBase64UrlDriver()`
- `createHexDriver()`

## Notes

- Base32 and Base64 support optional `includePadding` (defaults to `true`).
- Base64 URL-safe encoding defaults to `includePadding: false`.
- Hex output is uppercase and decode accepts lowercase or uppercase input.
