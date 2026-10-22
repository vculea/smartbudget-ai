import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetsApi, getErrorMessage, queryKeys } from "../../api";
import { useToast } from "../../app/useToast";
import type { BudgetInput, Period } from "../../types";

export function useBudgetsQuery(period: Period) {
  return useQuery({
    queryKey: queryKeys.budgetList(period),
    queryFn: () => budgetsApi.list(period),
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: BudgetInput) => budgetsApi.create(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.budgets }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAll }),
      ]);
      toast.success("Bugetul a fost creat.");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Bugetul nu a putut fi creat.")),
  });
}
