import type {
  BouncerPolicy,
  BouncerPolicyActionData,
  BouncerPolicyActionKey,
  BouncerPolicyDefinition,
  BouncerServiceContract,
} from './types.js';

/**
 * Creates a policy declaration.
 */
export function definePolicy<Handlers extends BouncerPolicy>(config: {
  handlers: Handlers;
  onException?: (message?: string) => void;
}): BouncerPolicyDefinition<Handlers> {
  if (config.onException) {
    return {
      handlers: config.handlers,
      onException: config.onException,
    };
  }

  return {
    handlers: config.handlers,
  };
}

/**
 * Creates a typed bouncer service.
 *
 * @param config.onException Fallback handler invoked when `authorize` fails.
 */
export function createBouncerService(
  config: { onException?: (message?: string) => void } = {},
): BouncerServiceContract {
  const resolveAction = <
    Policy extends BouncerPolicyDefinition<BouncerPolicy>,
    ActionKey extends BouncerPolicyActionKey<Policy>,
  >(
    policy: Policy,
    actionName: ActionKey,
  ): Policy['handlers'][ActionKey] => {
    const action = policy.handlers[actionName] as
      | Policy['handlers'][ActionKey]
      | undefined;

    if (typeof action !== 'function') {
      throw new Error(`Bouncer action "${String(actionName)}" is not defined`);
    }

    return action;
  };

  return {
    check: <
      Policy extends BouncerPolicyDefinition<BouncerPolicy>,
      ActionKey extends BouncerPolicyActionKey<Policy>,
    >(
      policy: Policy,
      action: ActionKey,
      data?: BouncerPolicyActionData<Policy, ActionKey>,
    ): { ok: boolean; message?: string } => {
      const checkedAction = resolveAction(policy, action);
      const result = checkedAction(data);

      return result;
    },

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
    ): void => {
      const checkedAction = resolveAction(policy, action);

      const result = checkedAction(data);

      if (result.ok === false) {
        const handler =
          options?.onException ?? policy.onException ?? config.onException;
        const message = result.message ?? 'Unauthorized';

        if (handler) {
          handler(message);
          return;
        }

        throw new Error(message);
      }
    },
  };
}
