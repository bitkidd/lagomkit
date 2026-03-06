export const MockPolicy = {
  authorized: (_: { hello: string }) => {
    return true;
  },

  withData: (data?: { hello: string }) => {
    return data?.hello === 'world';
  },

  unauthorizedPass: () => {
    return true;
  },

  unauthorizedThrow: () => {
    return false;
  },

  throws: () => {
    throw new Error('Policy exploded');
  },
};

export const MockPolicy2 = {
  authorized: (_: { world: string }) => {
    return true;
  },

  unauthorizedPass: () => {
    return true;
  },

  unauthorizedThrow: () => {
    return false;
  },
};
