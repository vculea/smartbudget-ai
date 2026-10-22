import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetsApi, getErrorMessage, queryKeys } from "../../api";
import { useToast } from "../../app/useToast";
import type { BudgetInput, YearMonth } from "../../types";

export function useBudgetsQuery(month: YearMonth) {
  return useQuery({
    queryKey: queryKeys.budgetList(month),
    queryFn: () => budgetsApi.list(month),
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
