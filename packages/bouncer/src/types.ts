export type BouncerAction<Data = any> = (data?: Data) => boolean;

export type BouncerPolicy = Record<string, BouncerAction>;

export interface BouncerServiceContract<
	AvailablePolicies extends Record<string, BouncerPolicy>,
> {
	check: <
		PolicyKey extends keyof AvailablePolicies & string,
		ActionKey extends keyof AvailablePolicies[PolicyKey] & string,
	>(args: {
		policy: PolicyKey;
		action: ActionKey;
		data?: Parameters<AvailablePolicies[PolicyKey][ActionKey]>[0];
	}) => boolean;
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
