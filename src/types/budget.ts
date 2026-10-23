import type { Period, YearMonth } from "./common";

/** Starea calculată de backend: WARNING de la 80% până la 100% inclusiv, EXCEEDED peste limită. */
export type BudgetStatus = "NORMAL" | "WARNING" | "EXCEEDED";

export interface Budget {
  id: string;
  categoryId: string;
  categoryName: string;
  /** `YYYY-MM`, sau `YYYY` când limitele sunt însumate pe un an. */
  month: Period;
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

/** Corp pentru `POST /budgets/year`: aceeași limită lunară pe categorie, în lunile alese (1-12). */
export interface BudgetYearInput {
  year: number;
  months: number[];
  items: { categoryId: string; limitAmount: number }[];
}

/** `skipped`: perechile categorie-lună care aveau deja buget și au rămas neschimbate. */
export interface BudgetYearResult {
  created: number;
  skipped: number;
}

/** REACHED: suma așteptată a fost încasată; BELOW: perioada s-a încheiat sub ea; PENDING: perioada e în curs. */
export type IncomePlanStatus = "PENDING" | "REACHED" | "BELOW";

/** Venit planificat (buget pe o categorie de venit), comparat cu ce s-a încasat (`GET /budgets/income`). */
export interface IncomePlan {
  id: string;
  categoryId: string;
  categoryName: string;
  /** `YYYY-MM`, sau `YYYY` când sumele lunare sunt însumate pe un an. */
  month: Period;
  expectedAmount: number;
  receivedAmount: number;
  /** Cât mai lipsește; niciodată negativ. */
  remainingAmount: number;
  percentageReceived: number;
  status: IncomePlanStatus;
}
