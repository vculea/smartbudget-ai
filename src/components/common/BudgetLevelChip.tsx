import { Chip } from "@mui/material";
import type { BudgetLevel } from "../../utils/budget";

const CONFIG: Record<
  BudgetLevel,
  { label: string; color: "success" | "warning" | "error" }
> = {
  ok: { label: "În limită", color: "success" },
  warning: { label: "Aproape de limită", color: "warning" },
  exceeded: { label: "Limită depășită", color: "error" },
};

export function BudgetLevelChip({ level }: { level: BudgetLevel }) {
  const { label, color } = CONFIG[level];
  return <Chip size="small" label={label} color={color} variant="outlined" />;
}
