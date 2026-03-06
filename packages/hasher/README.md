# @lagomkit/hasher

Small, typed hashing toolkit with composable drivers and a lightweight service factory.

## Quick start

```ts
import {
  createHasherService,
  createArgon2Driver,
  createSha2_256Driver,
} from '@lagomkit/hasher';

const hasher = createHasherService({
  default: 'argon2',
  drivers: {
    argon2: createArgon2Driver(),
    sha256: createSha2_256Driver(),
  },
});

const hash = await hasher.default().hash({ content: 'hello world' });
const verified = await hasher.use('argon2').verify({
  content: 'hello world',
  hash,
});
```

## API

### `createHasherService(config)`

Creates a hasher service with typed driver access.

- `config.default`: the default driver key
- `config.drivers`: a map of driver instances

Returned methods:

- `default()` returns the default driver
- `use(key)` returns a specific driver

### Driver contract

All driver factories return a `HasherDriver`:

```ts
type HasherDriver = {
  hash(input: { content: string }): Promise<string>;
  verify(input: { content: string; hash: string }): Promise<boolean>;
};
```

## Driver factories

### Password hashers

- `createArgon2Driver()`
- `createBcryptDriver({ cost? })`

### SHA-1

- `createSha1Driver()`

### SHA-2

- `createSha2_224Driver()`
- `createSha2_256Driver()`
- `createSha2_384Driver()`
- `createSha2_512Driver()`

Compatibility aliases:

- `createSha256Driver()`
- `createSha512Driver()`

### SHA-3

- `createSha3_224Driver()`
- `createSha3_256Driver()`
- `createSha3_384Driver()`
- `createSha3_512Driver()`

## Notes

- Input text is normalized with Unicode `NFKC` before hashing.
- SHA drivers are deterministic and produce lowercase hex output.
