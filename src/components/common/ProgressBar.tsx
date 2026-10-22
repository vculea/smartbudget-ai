import { LinearProgress } from "@mui/material";
import { palette } from "../../app/theme";
import { clampPercent } from "../../utils/format";

export type ProgressTone = "primary" | "warning" | "danger" | "success";

const COLORS: Record<ProgressTone, string> = {
  primary: palette.indigo,
  warning: palette.amber,
  danger: palette.red,
  success: palette.green,
};

interface ProgressBarProps {
  value: number;
  tone?: ProgressTone;
  label: string;
  height?: number;
}

export function ProgressBar({
  value,
  tone = "primary",
  label,
  height = 10,
}: ProgressBarProps) {
  return (
    <LinearProgress
      variant="determinate"
      value={clampPercent(value)}
      aria-label={label}
      sx={{
        height,
        borderRadius: height,
        bgcolor: "rgba(100, 116, 139, 0.14)",
        "& .MuiLinearProgress-bar": {
          borderRadius: height,
          bgcolor: COLORS[tone],
        },
      }}
    />
  );
}
