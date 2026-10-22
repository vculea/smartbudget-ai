import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { categoriesApi, queryKeys } from "../../api";
import type { Category } from "../../types";

export function useCategories() {
  const query = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => categoriesApi.list(),
    staleTime: 5 * 60_000,
  });
  const categories: Category[] = useMemo(() => query.data ?? [], [query.data]);
  const byId = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  return { ...query, categories, byId };
}
