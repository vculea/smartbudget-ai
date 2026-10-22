import type { Budget } from "./budget";
import type { Period, YearMonth } from "./common";
import type { Goal } from "./goal";
import type { Transaction } from "./transaction";

export interface MonthlyTrendPoint {
  month: YearMonth;
  income: number;
  expenses: number;
}

export interface CategoryExpense {
  categoryId: string;
  categoryName: string;
  amount: number;
  /** Procent din totalul cheltuielilor lunii, 0-100. */
  percentage: number;
}

export interface DashboardResponse {
  /** `YYYY-MM` pentru o lună, `YYYY` pentru un an întreg. */
  month: Period;
  totalIncome: number;
  totalExpenses: number;
  /** Venituri minus cheltuieli. */
  balance: number;
  /** Procent din venituri economisit, 0-100. */
  savingsRate: number;
  /** Cheltuieli pe categoriile cu buget / suma limitelor * 100; 0 fără bugete. */
  budgetUsedPercentage: number;
  /** Primele 5 categorii de cheltuieli ale lunii. */
  topCategories: CategoryExpense[];
  monthlyTrend: MonthlyTrendPoint[];
  expensesByCategory: CategoryExpense[];
  budgets: Budget[];
  goals: Goal[];
  recentTransactions: Transaction[];
}
