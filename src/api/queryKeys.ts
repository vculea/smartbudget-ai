import type { Period, TransactionQuery } from "../types";

export const queryKeys = {
  dashboard: (period: Period) => ["dashboard", period] as const,
  dashboardAll: ["dashboard"] as const,
  transactions: ["transactions"] as const,
  transactionList: (query: TransactionQuery) =>
    ["transactions", "list", query] as const,
  categories: ["categories"] as const,
  budgets: ["budgets"] as const,
  budgetList: (period: Period) => ["budgets", period] as const,
  goals: ["goals"] as const,
};
