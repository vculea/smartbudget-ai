import { Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { IncomePlan, IncomePlanStatus } from "../../types";
import { formatCurrency, formatPercent } from "../../utils/format";
import {
  ProgressBar,
  type ProgressTone,
} from "../../components/common/ProgressBar";

const STATUS: Record<
  IncomePlanStatus,
  { label: string; color: "success" | "default" | "warning"; tone: ProgressTone }
> = {
  REACHED: { label: "Atins", color: "success", tone: "success" },
  PENDING: { label: "În curs", color: "default", tone: "primary" },
  BELOW: { label: "Sub așteptări", color: "warning", tone: "warning" },
};

export function IncomePlanCard({ plan }: { plan: IncomePlan }) {
  const status = STATUS[plan.status];
  const extra = plan.receivedAmount - plan.expectedAmount;

  return (
    <Card
      component="article"
      aria-label={`Venit planificat ${plan.categoryName}`}
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
            {plan.categoryName}
          </Typography>
          <Chip size="small" label={status.label} color={status.color} />
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
            {formatCurrency(plan.receivedAmount)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            din {formatCurrency(plan.expectedAmount)} așteptat
          </Typography>
        </Stack>

        <ProgressBar
          value={plan.percentageReceived}
          tone={status.tone}
          label={`${plan.categoryName}: ${formatPercent(plan.percentageReceived)} din venitul planificat încasat`}
        />

        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            {formatPercent(plan.percentageReceived)} încasat
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: extra > 0 ? "success.main" : "text.primary",
            }}
          >
            {extra > 0
              ? `Peste plan cu ${formatCurrency(extra)}`
              : plan.remainingAmount > 0
                ? `Mai lipsesc ${formatCurrency(plan.remainingAmount)}`
                : "Încasat integral"}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
