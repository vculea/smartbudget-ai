import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  budgetPlanAiApi,
  budgetsApi,
  getErrorMessage,
  queryKeys,
} from "../../api";
import { useToast } from "../../app/useToast";
import type { BudgetInput, BudgetYearInput, Period } from "../../types";

export function useBudgetsQuery(period: Period) {
  return useQuery({
    queryKey: queryKeys.budgetList(period),
    queryFn: () => budgetsApi.list(period),
  });
}

export function useIncomePlansQuery(period: Period) {
  return useQuery({
    queryKey: queryKeys.incomePlanList(period),
    queryFn: () => budgetsApi.listIncome(period),
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

export function useCreateYearBudgets() {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: BudgetYearInput) => budgetsApi.createForYear(input),
    onSuccess: async ({ created, skipped }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.budgets }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAll }),
      ]);
      const kept =
        skipped > 0
          ? ` ${skipped} ${skipped === 1 ? "sumă exista deja și a rămas neschimbată" : "sume existau deja și au rămas neschimbate"}.`
          : "";
      if (created > 0) {
        toast.success(
          `${created === 1 ? "A fost salvată 1 sumă lunară" : `Au fost salvate ${created} sume lunare`}.${kept}`,
        );
      } else {
        toast.error(`Nu a fost salvată nicio sumă nouă.${kept}`);
      }
    },
  });
}

/** Propunerea AI nu salvează nimic; eroarea e afișată în dialog. */
export function useBudgetPlanSuggestion() {
  return useMutation({
    mutationFn: (year: number) => budgetPlanAiApi.suggest(year),
  });
}
