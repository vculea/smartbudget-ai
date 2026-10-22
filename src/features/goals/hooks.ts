import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, goalsApi, queryKeys } from "../../api";
import { useToast } from "../../app/useToast";
import type { ContributionInput, GoalInput } from "../../types";

export function useGoalsQuery() {
  return useQuery({
    queryKey: queryKeys.goals,
    queryFn: () => goalsApi.list(),
  });
}

function useInvalidateGoals() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.goals }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAll }),
    ]);
}

export function useCreateGoal() {
  const invalidate = useInvalidateGoals();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: GoalInput) => goalsApi.create(input),
    onSuccess: async () => {
      await invalidate();
      toast.success("Obiectivul a fost creat.");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Obiectivul nu a putut fi creat.")),
  });
}

export function useAddContribution() {
  const invalidate = useInvalidateGoals();
  const toast = useToast();
  return useMutation({
    mutationFn: ({
      goalId,
      input,
    }: {
      goalId: number;
      input: ContributionInput;
    }) => goalsApi.contribute(goalId, input),
    onSuccess: async (goal) => {
      await invalidate();
      toast.success(
        goal.status === "COMPLETED"
          ? `Felicitări! Ai atins obiectivul „${goal.name}”.`
          : "Contribuția a fost adăugată.",
      );
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, "Contribuția nu a putut fi adăugată."),
      ),
  });
}
