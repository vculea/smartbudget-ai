import { Chip } from "@mui/material";
import type { GoalDisplayStatus } from "../../types";

const CONFIG: Record<
  GoalDisplayStatus,
  { label: string; color: "primary" | "success" | "error" }
> = {
  ACTIVE: { label: "Activ", color: "primary" },
  COMPLETED: { label: "Finalizat", color: "success" },
  OVERDUE: { label: "Termen depășit", color: "error" },
};

export function GoalStatusChip({ status }: { status: GoalDisplayStatus }) {
  const { label, color } = CONFIG[status];
  return <Chip size="small" label={label} color={color} variant="outlined" />;
}

export const goalProgressTone = (status: GoalDisplayStatus) =>
  status === "COMPLETED"
    ? "success"
    : status === "OVERDUE"
      ? "danger"
      : "primary";
