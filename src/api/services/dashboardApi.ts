import type { DashboardApi } from "../contracts";
import { http } from "../http";
import type { DashboardResponse } from "../../types";
import { periodParams } from "../../utils/date";

export const httpDashboardApi: DashboardApi = {
  async get(period) {
    const { data } = await http.get<DashboardResponse>("/dashboard", {
      params: periodParams(period),
    });
    return data;
  },
};
