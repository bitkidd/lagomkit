# @lagomkit/bouncer

Small, typed authorization toolkit with policy-based checks and a lightweight service factory.

## Quick start

```ts
import { createBouncerService } from '@lagomkit/bouncer';

const bouncer = createBouncerService({
	policies: {
		post: {
			create: (input?: { role: 'admin' | 'editor' | 'viewer' }) => {
				return input?.role === 'admin' || input?.role === 'editor';
			},
			delete: (input?: { role: 'admin' | 'editor' | 'viewer' }) => {
				return input?.role === 'admin';
			},
		},
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
```

## API

### `createBouncerService(config)`

Creates a bouncer service with strongly typed policy and action access.

- `config.policies`: policy map keyed by policy name
- `config.onException`: optional fallback handler for unauthorized actions

Returned methods:

- `check(input)` returns `true` or `false`
- `authorize(input)` throws when unauthorized (or calls an exception handler)

## Notes

- If `authorize` fails and no exception handler exists, an error is thrown.
- Unknown policy names and action names throw explicit errors.
- Policy action input types are inferred from your policy definitions.
