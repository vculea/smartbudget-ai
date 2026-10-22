import type { TransactionQuery, YearMonth } from "../types";

export const queryKeys = {
  dashboard: (month: YearMonth) => ["dashboard", month] as const,
  dashboardAll: ["dashboard"] as const,
  transactions: ["transactions"] as const,
  transactionList: (query: TransactionQuery) =>
    ["transactions", "list", query] as const,
  categories: ["categories"] as const,
  budgets: ["budgets"] as const,
  budgetList: (month: YearMonth) => ["budgets", month] as const,
  goals: ["goals"] as const,
};
