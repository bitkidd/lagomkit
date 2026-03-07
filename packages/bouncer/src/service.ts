import type {
	BouncerPolicy,
	BouncerPolicyMap,
	BouncerPolicyDefinition,
	BouncerResolvedPolicies,
	BouncerServiceContract,
} from './types.js';

/**
 * Creates a policy declaration.
 */
export function definePolicy<Handlers extends BouncerPolicy>(config: {
	handlers: Handlers;
}): BouncerPolicyDefinition<Handlers> {
	return {
		handlers: config.handlers,
	};
}

/**
 * Creates a typed bouncer service from a policy map.
 *
 * @param config.policies Policy definitions keyed by policy name.
 * @param config.onException Fallback handler invoked when `authorize` fails.
 */
export function createBouncerService<
	AvailablePolicies extends BouncerPolicyMap,
>(config: {
	policies: AvailablePolicies;
	onException?: () => void;
}): BouncerServiceContract<BouncerResolvedPolicies<AvailablePolicies>> {
	const policies = new Map<string, BouncerPolicy>();

	for (const [policyKey, policyEntry] of Object.entries(config.policies)) {
		const handlers: BouncerPolicy = policyEntry.handlers;
		policies.set(policyKey, handlers);
	}

	const resolveAction = <
		PolicyKey extends keyof BouncerResolvedPolicies<AvailablePolicies> & string,
		ActionKey extends
			keyof BouncerResolvedPolicies<AvailablePolicies>[PolicyKey] & string,
	>(
		policyName: PolicyKey,
		actionName: ActionKey,
	): BouncerResolvedPolicies<AvailablePolicies>[PolicyKey][ActionKey] => {
		const policy = policies.get(policyName);

		if (!policy) {
			throw new Error(`Bouncer policy "${String(policyName)}" is not defined`);
		}

		const action = policy[actionName] as
			| BouncerResolvedPolicies<AvailablePolicies>[PolicyKey][ActionKey]
			| undefined;

		if (typeof action !== 'function') {
			throw new Error(
				`Bouncer policy "${String(policyName)}" action "${String(actionName)}" is not defined`,
			);
		}

		return action;
	};

	return {
		check: <
			PolicyKey extends keyof BouncerResolvedPolicies<AvailablePolicies> &
				string,
			ActionKey extends
				keyof BouncerResolvedPolicies<AvailablePolicies>[PolicyKey] & string,
		>(params: {
			policy: PolicyKey;
			action: ActionKey;
			data?: Parameters<
				BouncerResolvedPolicies<AvailablePolicies>[PolicyKey][ActionKey]
			>[0];
		}): boolean => {
			const checkedAction = resolveAction(params.policy, params.action);

			return checkedAction(params.data);
		},

		authorize: <
			PolicyKey extends keyof BouncerResolvedPolicies<AvailablePolicies> &
				string,
			ActionKey extends
				keyof BouncerResolvedPolicies<AvailablePolicies>[PolicyKey] & string,
		>(params: {
			policy: PolicyKey;
			action: ActionKey;
			data?: Parameters<
				BouncerResolvedPolicies<AvailablePolicies>[PolicyKey][ActionKey]
			>[0];
			onException?: () => void;
		}): void => {
			const checkedAction = resolveAction(params.policy, params.action);

			const result = checkedAction(params.data);

			if (result === false) {
				const handler = params.onException ?? config.onException;

				if (!handler) {
					throw new Error(
						`Bouncer policy "${String(params.policy)}" action "${String(params.action)}" is not authorized`,
					);
				}

				handler();
			}
		},
	};
}
