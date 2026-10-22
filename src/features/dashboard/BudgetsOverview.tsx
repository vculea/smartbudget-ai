import { Box, Button, Stack, Typography } from "@mui/material";
import { Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/common/EmptyState";
import { ProgressBar } from "../../components/common/ProgressBar";
import { SectionCard } from "../../components/common/SectionCard";
import type { Budget } from "../../types";
import { getBudgetLevelFromStatus } from "../../utils/budget";
import { formatCurrency, formatPercent } from "../../utils/format";

const TONE = { ok: "primary", warning: "warning", exceeded: "danger" } as const;

export function BudgetsOverview({ budgets }: { budgets: Budget[] }) {
  const sorted = [...budgets]
    .sort((a, b) => b.percentageUsed - a.percentageUsed)
    .slice(0, 5);

  return (
    <SectionCard
      title="Bugete"
      subtitle="Cele mai utilizate în perioada selectată"
      action={
        <Button component={Link} to="/budgets" size="small">
          Vezi toate
        </Button>
      }
    >
      {sorted.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Niciun buget definit"
          description="Creează bugete pentru a-ți controla cheltuielile."
        />
      ) : (
        <Stack
          component="ul"
          spacing={2.5}
          sx={{ listStyle: "none", p: 0, m: 0 }}
        >
          {sorted.map((budget) => {
            const level = getBudgetLevelFromStatus(budget);
            return (
              <Box component="li" key={budget.id}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  sx={{ mb: 0.75 }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {budget.categoryName}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      color:
                        level === "exceeded"
                          ? "error.main"
                          : level === "warning"
                            ? "warning.main"
                            : "text.secondary",
                    }}
                  >
                    {formatPercent(budget.percentageUsed)}
                  </Typography>
                </Stack>
                <ProgressBar
                  value={budget.percentageUsed}
                  tone={TONE[level]}
                  height={8}
                  label={`${budget.categoryName}: ${formatPercent(budget.percentageUsed)} utilizat`}
                />
                <Typography variant="caption" color="text.secondary">
                  {formatCurrency(budget.spentAmount)} din{" "}
                  {formatCurrency(budget.limitAmount)}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      )}
    </SectionCard>
  );
}
