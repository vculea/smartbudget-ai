import {
  Alert,
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import { AlertTriangle } from "lucide-react";
import type { Budget } from "../../types";
import { getBudgetLevel } from "../../utils/budget";
import { formatCurrency, formatPercent } from "../../utils/format";
import { BudgetLevelChip } from "../../components/common/BudgetLevelChip";
import {
  ProgressBar,
  type ProgressTone,
} from "../../components/common/ProgressBar";

const TONE_BY_LEVEL = {
  ok: "primary",
  warning: "warning",
  exceeded: "danger",
} as const satisfies Record<string, ProgressTone>;

export function BudgetCard({ budget }: { budget: Budget }) {
  const level = getBudgetLevel(budget.percentageUsed);
  const exceeded = level === "exceeded";

  return (
    <Card
      component="article"
      aria-label={`Buget ${budget.categoryName}`}
      sx={{ height: "100%" }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Typography component="h3" variant="subtitle1">
            {budget.categoryName}
          </Typography>
          <BudgetLevelChip level={level} />
        </Stack>

        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="baseline"
          sx={{ mb: 1 }}
        >
          <Typography
            variant="h5"
            sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}
          >
            {formatCurrency(budget.spentAmount)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            din {formatCurrency(budget.limitAmount)}
          </Typography>
        </Stack>

        <ProgressBar
          value={budget.percentageUsed}
          tone={TONE_BY_LEVEL[level]}
          label={`${budget.categoryName}: ${formatPercent(budget.percentageUsed)} din buget utilizat`}
        />

        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            {formatPercent(budget.percentageUsed)} utilizat
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: exceeded ? "error.main" : "text.primary",
            }}
          >
            {exceeded
              ? `Depășit cu ${formatCurrency(Math.abs(budget.remainingAmount))}`
              : `Rămas ${formatCurrency(budget.remainingAmount)}`}
          </Typography>
        </Stack>

        {level !== "ok" && (
          <Box sx={{ mt: 2 }}>
            <Alert
              severity={exceeded ? "error" : "warning"}
              icon={<AlertTriangle size={18} />}
              sx={{ py: 0, borderRadius: 2 }}
            >
              {exceeded
                ? "Ai depășit limita bugetului."
                : "Ai consumat peste 80% din buget."}
            </Alert>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
