# @lagomkit/bouncer

Type-safe authorization toolkit with policy/action checks and a lightweight service factory.

Policies are declared with `definePolicy({ handlers })`, then passed directly to `check(...)` and `authorize(...)` for strongly typed action and payload inference.

## Quick start

```ts
import { createBouncerService, definePolicy } from '@lagomkit/bouncer';

const bouncer = createBouncerService();

const postPolicy = definePolicy({
		handlers: {
			create: (input?: { role: 'admin' | 'editor' | 'viewer' }) => {
				return input?.role === 'admin' || input?.role === 'editor'
					? { ok: true }
					: { ok: false, message: 'Post creation is not allowed' };
			},
			delete: (input?: { role: 'admin' | 'editor' | 'viewer' }) => {
				return input?.role === 'admin'
					? { ok: true }
					: { ok: false, message: 'Only admins can delete posts' };
			},
		},
		onException: (message) => {
			throw new Error(message ?? 'Unauthorized');
		},
});

const canCreate = bouncer.check(postPolicy, 'create', { role: 'editor' });

bouncer.authorize(postPolicy, 'delete', { role: 'viewer' });

// compile-time payload safety per action
// @ts-expect-error wrong payload shape for post.delete
bouncer.check(postPolicy, 'delete', { userId: '1' });
```

## API

### `createBouncerService(config?)`

Creates a bouncer service with strongly typed policy and action access.

- `config.onException`: optional fallback handler for unauthorized actions

Returned methods:

- `check(policy, action, data?)` returns `true` or `false`
- `authorize(policy, action, data?, options?)` throws when unauthorized (or calls an exception handler)

### `definePolicy({ handlers, onException? })`

Creates a policy declaration with typed action handlers.

- `handlers`: policy action functions returning `{ ok: true }` or `{ ok: false; message?: string }`
- `onException`: optional policy-level handler used when `authorize(...)` fails

## Notes

- Policies must be declared via `definePolicy({ handlers, onException? })`.
- `authorize(...)` resolves exception handlers in this order: call options, policy config, service config.
- `authorize(...)` passes the policy result message to `onException`, or `Unauthorized` when none is provided.
- If `authorize` fails and no exception handler exists, an error is thrown with that message.
- Unknown action names throw explicit errors.
- Policy action input types are inferred from your policy definitions.
