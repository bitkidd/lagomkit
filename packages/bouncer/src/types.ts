/**
 * Policy action function that decides whether an operation is allowed.
 */
export type BouncerAction<Data = any> = (data?: Data) => boolean;

/**
 * Collection of named actions for a single policy.
 */
export type BouncerPolicy = Record<string, BouncerAction>;

/**
 * Policy declaration shape used by `definePolicy`.
 */
export interface BouncerPolicyDefinition<Handlers extends BouncerPolicy> {
	handlers: Handlers;
}

/**
 * Policy map accepted in `createBouncerService({ policies })`.
 */
export type BouncerPolicyMap = Record<
	string,
	BouncerPolicyDefinition<BouncerPolicy>
>;

/**
 * Resolved action map extracted from policy entries.
 */
export type BouncerResolvedPolicies<Policies extends BouncerPolicyMap> = {
	[PolicyKey in keyof Policies &
		string]: Policies[PolicyKey] extends BouncerPolicyDefinition<infer Handlers>
		? Handlers
		: never;
};

/**
 * Typed bouncer service API.
 */
export interface BouncerServiceContract<
	AvailablePolicies extends Record<string, BouncerPolicy>,
> {
	/**
	 * Returns `true` when the policy action authorizes the input.
	 */
	check: <
		PolicyKey extends keyof AvailablePolicies & string,
		ActionKey extends keyof AvailablePolicies[PolicyKey] & string,
	>(args: {
		policy: PolicyKey;
		action: ActionKey;
		data?: Parameters<AvailablePolicies[PolicyKey][ActionKey]>[0];
	}) => boolean;
	/**
	 * Enforces authorization for a policy action.
	 *
	 * When unauthorized, it calls `onException` from params or service config.
	 * If no handler is configured, it throws.
	 */
	authorize: <
		PolicyKey extends keyof AvailablePolicies & string,
		ActionKey extends keyof AvailablePolicies[PolicyKey] & string,
	>(args: {
		policy: PolicyKey;
		action: ActionKey;
		data?: Parameters<AvailablePolicies[PolicyKey][ActionKey]>[0];
		onException?: () => void;
	}) => void;
}
