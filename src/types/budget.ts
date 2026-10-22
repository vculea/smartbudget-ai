import type { YearMonth } from "./common";

/** Starea calculată de backend: WARNING de la 80% până la 100% inclusiv, EXCEEDED peste limită. */
export type BudgetStatus = "NORMAL" | "WARNING" | "EXCEEDED";

export interface Budget {
  id: string;
  categoryId: string;
  categoryName: string;
  month: YearMonth;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  /** Procent utilizat, poate depăși 100. */
  percentageUsed: number;
  status: BudgetStatus;
}

/** Corp pentru `POST /budgets`. */
export interface BudgetInput {
  categoryId: string;
  month: YearMonth;
  limitAmount: number;
}
