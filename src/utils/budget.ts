export type BudgetLevel = "ok" | "warning" | "exceeded";

export const BUDGET_WARNING_THRESHOLD = 80;

export function getBudgetLevel(percentageUsed: number): BudgetLevel {
  if (percentageUsed > 100) return "exceeded";
  if (percentageUsed >= BUDGET_WARNING_THRESHOLD) return "warning";
  return "ok";
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
