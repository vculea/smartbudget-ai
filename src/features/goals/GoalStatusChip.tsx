import { Chip } from "@mui/material";
import type { GoalStatus } from "../../types";

const CONFIG: Record<
  GoalStatus,
  { label: string; color: "primary" | "success" | "error" }
> = {
  ACTIVE: { label: "Activ", color: "primary" },
  COMPLETED: { label: "Finalizat", color: "success" },
  OVERDUE: { label: "Termen depășit", color: "error" },
};

export function GoalStatusChip({ status }: { status: GoalStatus }) {
  const { label, color } = CONFIG[status];
  return <Chip size="small" label={label} color={color} variant="outlined" />;
}

export const goalProgressTone = (status: GoalStatus) =>
  status === "COMPLETED"
    ? "success"
    : status === "OVERDUE"
      ? "danger"
      : "primary";
