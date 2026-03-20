export const MockPolicy = {
	authorized: (_: { hello: string }) => {
		return { ok: true };
	},

	withData: (data?: { hello: string }) => {
		return data?.hello === 'world'
			? { ok: true }
			: { ok: false, message: 'Hello must be world' };
	},

	unauthorizedPass: () => {
		return { ok: true };
	},

	unauthorizedThrow: () => {
		return { ok: false, message: 'Unauthorized action' };
	},

	unauthorizedDefaultMessage: () => {
		return { ok: false };
	},

	throws: () => {
		throw new Error('Policy exploded');
	},
};

export const MockPolicy2 = {
	authorized: (_: { world: string }) => {
		return { ok: true };
	},

	unauthorizedPass: () => {
		return { ok: true };
	},

	unauthorizedThrow: () => {
		return { ok: false, message: 'Unauthorized action' };
	},
};
