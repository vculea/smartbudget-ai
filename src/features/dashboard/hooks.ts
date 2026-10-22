import { useQuery } from "@tanstack/react-query";
import { dashboardApi, queryKeys } from "../../api";
import type { YearMonth } from "../../types";

export function useDashboardQuery(month: YearMonth) {
  return useQuery({
    queryKey: queryKeys.dashboard(month),
    queryFn: () => dashboardApi.get(month),
  });
}
