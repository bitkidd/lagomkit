/**
 * Policy action result returned by a policy handler.
 */
export type BouncerActionResult =
	| { ok: true }
	| { ok: false; message?: string };

/**
 * Policy action function that returns a structured authorization result.
 */
export type BouncerAction<Data = any> = (data?: Data) => BouncerActionResult;

/**
 * Collection of named actions for a single policy.
 */
export type BouncerPolicy = Record<string, BouncerAction>;

/**
 * Policy declaration shape used by `definePolicy`.
 */
export interface BouncerPolicyDefinition<Handlers extends BouncerPolicy> {
	handlers: Handlers;
	onException?: (message?: string) => void;
}

/**
 * Named action keys available for a given policy definition.
 */
export type BouncerPolicyActionKey<
	Policy extends BouncerPolicyDefinition<BouncerPolicy>,
> = keyof Policy['handlers'] & string;

/**
 * Input payload inferred for a policy action.
 */
export type BouncerPolicyActionData<
	Policy extends BouncerPolicyDefinition<BouncerPolicy>,
	ActionKey extends BouncerPolicyActionKey<Policy>,
> = Parameters<Policy['handlers'][ActionKey]>[0];

/**
 * Typed bouncer service API.
 */
export interface BouncerServiceContract {
	/**
	 * Returns `true` when the policy action authorizes the input.
	 */
	check: <
		Policy extends BouncerPolicyDefinition<BouncerPolicy>,
		ActionKey extends BouncerPolicyActionKey<Policy>,
	>(
		policy: Policy,
		action: ActionKey,
		data?: BouncerPolicyActionData<Policy, ActionKey>,
	) => boolean;
	/**
	 * Enforces authorization for a policy action.
	 *
	 * When unauthorized, it calls `onException` from call options, policy config,
	 * or service config.
	 * If no handler is configured, it throws.
	 */
	authorize: <
		Policy extends BouncerPolicyDefinition<BouncerPolicy>,
		ActionKey extends BouncerPolicyActionKey<Policy>,
	>(
		policy: Policy,
		action: ActionKey,
		data?: BouncerPolicyActionData<Policy, ActionKey>,
		options?: {
			onException?: (message?: string) => void;
		},
	) => void;
}
