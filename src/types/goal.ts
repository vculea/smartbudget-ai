import type { IsoDate } from "./common";

/** Statusuri trimise de backend. */
export type GoalStatus = "ACTIVE" | "COMPLETED";

/** Statusul afișat în UI: `OVERDUE` este derivat local din termen, nu vine din API. */
export type GoalDisplayStatus = GoalStatus | "OVERDUE";

export interface Goal {
  id: string;
  name: string;
  description?: string | null;
  targetAmount: number;
  /** Suma contribuțiilor, calculată de backend. */
  currentAmount: number;
  /** Termenul este opțional în backend. */
  targetDate: IsoDate | null;
  status: GoalStatus;
  /** Procent de progres, 0-100. */
  progressPercentage: number;
}

/** Corp pentru `POST /goals`. */
export interface GoalInput {
  name: string;
  targetAmount: number;
  targetDate?: IsoDate;
  description?: string;
}

/** Corp pentru `POST /goals/{id}/contributions`. */
export interface ContributionInput {
  amount: number;
}
