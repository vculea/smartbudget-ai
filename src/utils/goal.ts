import type { Goal, GoalDisplayStatus } from "../types";
import { daysUntil } from "./date";

/** Backendul trimite doar ACTIVE/COMPLETED; „termen depășit” se deduce din dată. */
export function getGoalDisplayStatus(
  goal: Pick<Goal, "status" | "targetDate">,
): GoalDisplayStatus {
  if (
    goal.status === "ACTIVE" &&
    goal.targetDate &&
    daysUntil(goal.targetDate) < 0
  ) {
    return "OVERDUE";
  }
  return goal.status;
}
