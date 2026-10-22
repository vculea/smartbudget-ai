import type { IsoDate } from "./common";

export type GoalStatus = "ACTIVE" | "COMPLETED" | "OVERDUE";

export interface Goal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: IsoDate;
  status: GoalStatus;
  /** Procent de progres, 0-100. */
  progressPercentage: number;
}

/** Corp pentru `POST /goals`. */
export interface GoalInput {
  name: string;
  targetAmount: number;
  targetDate: IsoDate;
  currentAmount?: number;
}

/** Corp pentru `POST /goals/{id}/contributions`. */
export interface ContributionInput {
  amount: number;
}
