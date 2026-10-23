import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  categoryMemoryApi,
  getErrorMessage,
  queryKeys,
  transactionsApi,
} from "../../api";
import { useToast } from "../../app/useToast";
import type {
  CategoryMemoryLesson,
  ScanOptions,
  TransactionInput,
  TransactionQuery,
} from "../../types";
import { prepareImageForUpload } from "../../utils/image";

export function useTransactionsQuery(query: TransactionQuery) {
  return useQuery({
    queryKey: queryKeys.transactionList(query),
    queryFn: () => transactionsApi.list(query),
    placeholderData: keepPreviousData,
  });
}

/** Tranzacțiile influențează dashboardul, bugetele și memoria categoriilor, deci toate se invalidează. */
function useInvalidateFinanceData() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAll }),
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets }),
      queryClient.invalidateQueries({ queryKey: queryKeys.categoryMemory }),
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

const importedMessage = (created: number) =>
  created === 1
    ? "S-a importat o tranzacție."
    : `S-au importat ${created} tranzacții.`;

/**
 * Salvează tranzacțiile verificate în previzualizarea importului (sau citite dintr-o poză),
 * apoi învață din categoriile păstrate. Dacă memoria nu poate fi actualizată, salvarea rămâne reușită.
 */
export function useImportTransactions(
  successMessage: (created: number) => string = importedMessage,
) {
  const invalidate = useInvalidateFinanceData();
  const toast = useToast();
  return useMutation({
    mutationFn: async ({
      inputs,
      lessons = [],
    }: {
      inputs: TransactionInput[];
      lessons?: CategoryMemoryLesson[];
    }) => {
      const result = await transactionsApi.createMany(inputs);
      if (lessons.length > 0) {
        await categoryMemoryApi.learn(lessons).catch(() => undefined);
      }
      return result;
    },
    onSuccess: async ({ created }) => {
      await invalidate();
      toast.success(successMessage(created));
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Importul nu a putut fi salvat.")),
  });
}

/** Citește poza unui bon / extras cu AI; nu salvează nimic, doar propune tranzacțiile. */
export function useScanTransaction() {
  return useMutation({
    mutationFn: async ({
      image,
      options,
    }: {
      image: Blob;
      options?: ScanOptions;
    }) => transactionsApi.scan(await prepareImageForUpload(image), options),
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
