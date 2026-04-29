# LagomKit

Type-safe, composable TypeScript utilities for Node.js, organized as a monorepo of focused packages.

LagomKit packages follow a consistent pattern: small service factories, typed contracts, and swappable drivers where it makes sense.

## The Idea

LagomKit is built around the idea of balanced tooling: not too abstract, not too low-level.
Each package aims to provide just enough structure to keep code predictable and type-safe,
without forcing a heavyweight framework or hiding core behavior.

## Why LagomKit

- Strong TypeScript inference for safer APIs
- Small, focused packages that do one job well
- Consistent service-style architecture across packages
- Practical defaults with room for custom behavior

## Packages

| Package | Purpose |
| --- | --- |
| [`@lagomkit/bouncer`](./packages/bouncer/README.md) | Type-safe authorization with policy/action checks |
| [`@lagomkit/encoder`](./packages/encoder/README.md) | Encoding toolkit (base32, base64, base64url, hex) |
| [`@lagomkit/hasher`](./packages/hasher/README.md) | Hashing toolkit (Argon2, bcrypt, SHA-1, SHA-2, SHA-3) |
| [`@lagomkit/limiter`](./packages/limiter/README.md) | Rate-limiting service with an in-memory driver |
| [`@lagomkit/mailer`](./packages/mailer/README.md) | Mail delivery service with an SMTP driver |
| [`@lagomkit/queue`](./packages/queue/README.md) | Typed job queue service built on `pg-boss` |
| [`@lagomkit/random`](./packages/random/README.md) | Random string/token/UUID generation |

## Install

Install only the package you need:

```bash
pnpm add @lagomkit/bouncer
pnpm add @lagomkit/encoder
pnpm add @lagomkit/hasher
pnpm add @lagomkit/limiter
pnpm add @lagomkit/mailer
pnpm add @lagomkit/queue
pnpm add @lagomkit/random
```

Then follow the package-specific docs in `packages/*/README.md` for usage details.

## Development

### Requirements

- Node.js 24+
- pnpm 10+

### Setup

```bash
pnpm install
```

### Common workspace commands

```bash
pnpm -r build
pnpm -r test
pnpm -r coverage
pnpm -r check
```

Run a command for one package:

```bash
pnpm --filter @lagomkit/encoder test
```

## License

MIT - see [`LICENSE`](./LICENSE).
