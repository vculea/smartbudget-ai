import { useQuery } from "@tanstack/react-query";
import { dashboardApi, queryKeys } from "../../api";
import type { Period } from "../../types";

export function useDashboardQuery(period: Period) {
  return useQuery({
    queryKey: queryKeys.dashboard(period),
    queryFn: () => dashboardApi.get(period),
  });
}
