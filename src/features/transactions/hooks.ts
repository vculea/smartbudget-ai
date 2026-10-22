import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { getErrorMessage, queryKeys, transactionsApi } from "../../api";
import { useToast } from "../../app/useToast";
import type { TransactionInput, TransactionQuery } from "../../types";
import { prepareImageForUpload } from "../../utils/image";

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
    mutationFn: ({ id, input }: { id?: string; input: TransactionInput }) =>
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

/** Salvează tranzacțiile verificate în previzualizarea importului. */
export function useImportTransactions() {
  const invalidate = useInvalidateFinanceData();
  const toast = useToast();
  return useMutation({
    mutationFn: (inputs: TransactionInput[]) =>
      transactionsApi.createMany(inputs),
    onSuccess: async ({ created }) => {
      await invalidate();
      toast.success(
        created === 1
          ? "S-a importat o tranzacție."
          : `S-au importat ${created} tranzacții.`,
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Importul nu a putut fi salvat.")),
  });
}

/** Citește poza unui bon cu AI; nu salvează nimic, doar propune valorile formularului. */
export function useScanTransaction() {
  return useMutation({
    mutationFn: async (image: Blob) =>
      transactionsApi.scan(await prepareImageForUpload(image)),
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateFinanceData();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => transactionsApi.remove(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Tranzacția a fost ștearsă.");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Tranzacția nu a putut fi ștearsă.")),
  });
}
