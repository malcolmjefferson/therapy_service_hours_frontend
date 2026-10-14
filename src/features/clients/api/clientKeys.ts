/** Query key factory for the clients feature (FE-32). */
export const clientKeys = {
  all: ['clients'] as const,
  list: () => [...clientKeys.all, 'list'] as const,
};
