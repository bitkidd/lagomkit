# @lagomkit/bouncer

Type-safe authorization toolkit with policy/action checks and a lightweight service factory.

Policies are declared with `definePolicy({ handlers })`, then passed to `createBouncerService({ policies })` for strongly typed `check(...)` and `authorize(...)` calls.

## Quick start

```ts
import { createBouncerService, definePolicy } from '@lagomkit/bouncer';

const bouncer = createBouncerService({
	policies: {
		post: definePolicy({
			handlers: {
				create: (input?: { role: 'admin' | 'editor' | 'viewer' }) => {
					return input?.role === 'admin' || input?.role === 'editor';
				},
				delete: (input?: { role: 'admin' | 'editor' | 'viewer' }) => {
					return input?.role === 'admin';
				},
			},
		}),
	},
});

const canCreate = bouncer.check({
	policy: 'post',
	action: 'create',
	data: { role: 'editor' },
});

bouncer.authorize({
	policy: 'post',
	action: 'delete',
	data: { role: 'viewer' },
	onException: () => {
		throw new Error('Not allowed');
	},
});

// compile-time payload safety per action
// @ts-expect-error wrong payload shape for post.delete
bouncer.check({ policy: 'post', action: 'delete', data: { userId: '1' } });
```

## API

### `createBouncerService(config)`

Creates a bouncer service with strongly typed policy and action access.

- `config.policies`: policy map keyed by policy name where each value is `definePolicy({ handlers })`
- `config.onException`: optional fallback handler for unauthorized actions

Returned methods:

- `check(input)` returns `true` or `false`
- `authorize(input)` throws when unauthorized (or calls an exception handler)

### `definePolicy({ handlers })`

Creates a policy declaration with typed action handlers.

- `handlers`: policy action functions

## Notes

- Policies must be declared via `definePolicy({ handlers })`.
- If `authorize` fails and no exception handler exists, an error is thrown.
- Unknown policy names and action names throw explicit errors.
- Policy action input types are inferred from your policy definitions.
