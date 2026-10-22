import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesApi, getErrorMessage, queryKeys } from "../../api";
import { useToast } from "../../app/useToast";
import type { CategoryInput } from "../../types";

/** Numele categoriilor apar în tranzacții, bugete și dashboard, deci toate se reîncarcă. */
function useInvalidateCategoryData() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.categories,
        exact: true,
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAll }),
    ]);
}

export function useSaveCategory() {
  const invalidate = useInvalidateCategoryData();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CategoryInput }) =>
      id === undefined
        ? categoriesApi.create(input)
        : categoriesApi.update(id, input),
    onSuccess: async (_data, { id }) => {
      await invalidate();
      toast.success(
        id === undefined
          ? "Categoria a fost adăugată."
          : "Categoria a fost actualizată.",
      );
    },
  });
}

export function useCategoryUsage(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.categories, "usage", id],
    queryFn: () => categoriesApi.usage(id as string),
    enabled: enabled && id !== undefined,
    staleTime: 0,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateCategoryData();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, replacementId }: { id: string; replacementId?: string }) =>
      categoriesApi.remove(id, replacementId),
    onSuccess: async () => {
      await invalidate();
      toast.success("Categoria a fost ștearsă.");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Categoria nu a putut fi ștearsă.")),
  });
}
