export type BudgetLevel = "ok" | "warning" | "exceeded";

export const BUDGET_WARNING_THRESHOLD = 80;

/** Fallback după procent; pentru date primite de la API se folosește `getBudgetLevelFromStatus`. */
export function getBudgetLevel(percentageUsed: number): BudgetLevel {
  if (percentageUsed > 100) return "exceeded";
  if (percentageUsed >= BUDGET_WARNING_THRESHOLD) return "warning";
  return "ok";
}

/** Backendul decide starea pe sume exacte; procentul afișat este doar rotunjit. */
export function getBudgetLevelFromStatus(budget: {
  status: "NORMAL" | "WARNING" | "EXCEEDED";
}): BudgetLevel {
  return budget.status === "EXCEEDED"
    ? "exceeded"
    : budget.status === "WARNING"
      ? "warning"
      : "ok";
}

export const CHART_COLORS = [
  "#4f46e5",
  "#7c3aed",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#64748b",
  "#a855f7",
] as const;

export const chartColor = (index: number): string =>
  CHART_COLORS[index % CHART_COLORS.length] ?? "#4f46e5";
