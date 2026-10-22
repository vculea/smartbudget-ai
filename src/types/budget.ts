import type { YearMonth } from "./common";

export interface Budget {
  id: number;
  categoryId: number;
  categoryName: string;
  month: YearMonth;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  /** Procent utilizat, poate depăși 100. */
  percentageUsed: number;
}

/** Corp pentru `POST /budgets`. */
export interface BudgetInput {
  categoryId: number;
  month: YearMonth;
  limitAmount: number;
}
