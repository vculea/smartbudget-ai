import type { BudgetsApi } from "../contracts";
import { http } from "../http";
import type { Budget } from "../../types";

export const httpBudgetsApi: BudgetsApi = {
  async list(month) {
    const { data } = await http.get<Budget[]>("/budgets", {
      params: { month },
    });
    return data;
  },
  async create(input) {
    const { data } = await http.post<Budget>("/budgets", input);
    return data;
  },
};
