import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, useApiClient, type components } from '../../../lib/api';
import { withTarget } from '../model/goalCards';
import { goalKeys } from './goalKeys';
import type { GoalsProgress } from './useGoalsProgressQuery';

type GoalType = components['schemas']['GoalType'];
type GoalTarget = components['schemas']['GoalTarget'];

export interface UpdateGoalTargetInput {
  goalType: GoalType;
  targetHours: number;
}

/**
 * Saves a new target (FR-GOAL-02). It waits for the server, then writes the new target and percents
 * into the cached progress so the bar moves at once, and refetches to settle on the server's numbers.
 */
export function useUpdateGoalTarget() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<GoalTarget, ApiError, UpdateGoalTargetInput>({
    mutationFn: async ({ goalType, targetHours }) => {
      let result;
      try {
        result = await client.PUT('/goals/{goalType}', {
          params: { path: { goalType } },
          body: { target_hours: targetHours },
        });
      } catch {
        throw new ApiError(undefined, undefined);
      }
      if (!result.data) {
        throw new ApiError(result.response.status, 'type' in result.error ? result.error : undefined);
      }
      return result.data;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<GoalsProgress>(goalKeys.progress(), (current) =>
        current ? { goals: current.goals.map((goal) => withTarget(goal, saved)) } : current,
      );
      return queryClient.invalidateQueries({ queryKey: goalKeys.progress() });
    },
  });
}
