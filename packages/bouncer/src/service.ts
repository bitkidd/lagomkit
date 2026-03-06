import type { BouncerPolicy, BouncerServiceContract } from './types.js';

export function createBouncerService<
	AvailablePolicies extends Record<string, BouncerPolicy>,
>(config: {
	policies: AvailablePolicies;
	onException?: () => void;
}): BouncerServiceContract<AvailablePolicies> {
	const resolveAction = <
		PolicyKey extends keyof AvailablePolicies & string,
		ActionKey extends keyof AvailablePolicies[PolicyKey] & string,
	>(
		policyName: PolicyKey,
		actionName: ActionKey,
	): AvailablePolicies[PolicyKey][ActionKey] => {
		const policy = config.policies[policyName];

		if (!policy) {
			throw new Error(`Bouncer policy "${String(policyName)}" is not defined`);
		}

		const action = policy[actionName] as
			| AvailablePolicies[PolicyKey][ActionKey]
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
			PolicyKey extends keyof AvailablePolicies & string,
			ActionKey extends keyof AvailablePolicies[PolicyKey] & string,
		>(params: {
			policy: PolicyKey;
			action: ActionKey;
			data?: Parameters<AvailablePolicies[PolicyKey][ActionKey]>[0];
		}): boolean => {
			const checkedAction = resolveAction(params.policy, params.action);

			return checkedAction(params.data);
		},

		authorize: <
			PolicyKey extends keyof AvailablePolicies & string,
			ActionKey extends keyof AvailablePolicies[PolicyKey] & string,
		>(params: {
			policy: PolicyKey;
			action: ActionKey;
			data?: Parameters<AvailablePolicies[PolicyKey][ActionKey]>[0];
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
