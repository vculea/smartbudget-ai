import type { BudgetPlanAiApi, BudgetsApi } from "../contracts";
import { http } from "../http";
import type {
  Budget,
  BudgetPlan,
  BudgetYearResult,
  IncomePlan,
} from "../../types";
import { periodParams } from "../../utils/date";

export const httpBudgetsApi: BudgetsApi = {
  async list(period) {
    const { data } = await http.get<Budget[]>("/budgets", {
      params: periodParams(period),
    });
    return data;
  },
  async listIncome(period) {
    const { data } = await http.get<IncomePlan[]>("/budgets/income", {
      params: periodParams(period),
    });
    return data;
  },
  async create(input) {
    const { data } = await http.post<Budget>("/budgets", input);
    return data;
  },
  async createForYear(input) {
    const { data } = await http.post<BudgetYearResult>("/budgets/year", input);
    return data;
  },
};

// Propunerea AI rulează în backend; răspunsul poate dura mai mult.
export const httpBudgetPlanAiApi: BudgetPlanAiApi = {
  async suggest(year) {
    const { data } = await http.post<BudgetPlan>(
      "/ai/budget-plan",
      { year },
      { timeout: 180_000 },
    );
    return data;
  },
};
