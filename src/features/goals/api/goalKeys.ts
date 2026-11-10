/** Query key factory for the goals feature (FE-32). */
export const goalKeys = {
  all: ['goals'] as const,
  progress: () => [...goalKeys.all, 'progress'] as const,
};
