import type { DashboardApi } from "../contracts";
import { http } from "../http";
import type { DashboardResponse } from "../../types";

export const httpDashboardApi: DashboardApi = {
  async get(month) {
    const { data } = await http.get<DashboardResponse>("/dashboard", {
      params: { month },
    });
    return data;
  },
};
