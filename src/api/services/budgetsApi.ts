import type { BudgetsApi } from "../contracts";
import { http } from "../http";
import type { Budget } from "../../types";
import { periodParams } from "../../utils/date";

export const httpBudgetsApi: BudgetsApi = {
  async list(period) {
    const { data } = await http.get<Budget[]>("/budgets", {
      params: periodParams(period),
    });
    return data;
  },
  async create(input) {
    const { data } = await http.post<Budget>("/budgets", input);
    return data;
  },
};
