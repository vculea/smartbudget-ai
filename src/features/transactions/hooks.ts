import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { getErrorMessage, queryKeys, transactionsApi } from "../../api";
import { useToast } from "../../app/useToast";
import type { TransactionInput, TransactionQuery } from "../../types";

export function useTransactionsQuery(query: TransactionQuery) {
  return useQuery({
    queryKey: queryKeys.transactionList(query),
    queryFn: () => transactionsApi.list(query),
    placeholderData: keepPreviousData,
  });
}

/** Tranzacțiile influențează dashboardul și bugetele, deci toate se invalidează. */
function useInvalidateFinanceData() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAll }),
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets }),
    ]);
}

export function useSaveTransaction() {
  const invalidate = useInvalidateFinanceData();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: TransactionInput }) =>
      id === undefined
        ? transactionsApi.create(input)
        : transactionsApi.update(id, input),
    onSuccess: async (_data, { id }) => {
      await invalidate();
      toast.success(
        id === undefined
          ? "Tranzacția a fost adăugată."
          : "Tranzacția a fost actualizată.",
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Tranzacția nu a putut fi salvată.")),
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateFinanceData();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: number) => transactionsApi.remove(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Tranzacția a fost ștearsă.");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Tranzacția nu a putut fi ștearsă.")),
  });
}
