import { Box, Button } from "@mui/material";
import { Plus, Wallet, PiggyBank, Receipt, Scale } from "lucide-react";
import { useState } from "react";
import { useSelectedPeriod } from "../../app/PeriodContext";
import { getErrorMessage } from "../../api";
import { EmptyState } from "../../components/common/EmptyState";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingBlock } from "../../components/common/LoadingBlock";
import { PageHeader } from "../../components/common/PageHeader";
import { PeriodSelector } from "../../components/common/PeriodSelector";
import { StatCard } from "../../components/common/StatCard";
import { formatCurrency } from "../../utils/format";
import { formatPeriodLabel, isYearPeriod } from "../../utils/date";
import { BudgetCard } from "./BudgetCard";
import { BudgetFormDialog } from "./BudgetFormDialog";
import { useBudgetsQuery } from "./hooks";

export function BudgetsPage() {
  const { period } = useSelectedPeriod();
  const yearly = isYearPeriod(period);
  const [formOpen, setFormOpen] = useState(false);
  const { data, isLoading, isError, error, refetch } = useBudgetsQuery(period);

  const budgets = data ?? [];
  const totalLimit = budgets.reduce((sum, b) => sum + b.limitAmount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spentAmount, 0);

  return (
    <>
      <PageHeader
        title="Bugete"
        subtitle={
          yearly
            ? `Limitele lunare însumate pentru ${formatPeriodLabel(period).toLowerCase()}. Alege o lună pentru a adăuga un buget.`
            : `Limite de cheltuieli pentru ${formatPeriodLabel(period).toLowerCase()}.`
        }
        actions={
          <>
            <PeriodSelector />
            {!yearly && (
              <Button
                variant="contained"
                startIcon={<Plus size={18} />}
                onClick={() => setFormOpen(true)}
              >
                Buget nou
              </Button>
            )}
          </>
        }
      />

      {isLoading ? (
        <LoadingBlock rows={3} height={140} />
      ) : isError ? (
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : budgets.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Niciun buget pentru această perioadă"
          description={
            yearly
              ? "Alege o lună pentru a defini limite pe categorii."
              : "Definește limite pe categorii pentru a ține cheltuielile sub control."
          }
          action={
            yearly ? undefined : (
              <Button variant="contained" onClick={() => setFormOpen(true)}>
                Creează primul buget
              </Button>
            )
          }
        />
      ) : (
        <>
          <Box
            sx={{
              display: "grid",
              gap: 2.5,
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
              mb: 3,
            }}
          >
            <StatCard
              label="Total limite"
              value={formatCurrency(totalLimit)}
              icon={PiggyBank}
              tone="indigo"
            />
            <StatCard
              label="Total cheltuit"
              value={formatCurrency(totalSpent)}
              icon={Receipt}
              tone="violet"
            />
            <StatCard
              label="Total rămas"
              value={formatCurrency(totalLimit - totalSpent)}
              icon={Scale}
              tone={totalLimit - totalSpent >= 0 ? "green" : "red"}
            />
          </Box>
          <Box
            component="ul"
            sx={{
              listStyle: "none",
              m: 0,
              p: 0,
              display: "grid",
              gap: 2.5,
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, 1fr)",
                xl: "repeat(3, 1fr)",
              },
            }}
          >
            {budgets.map((budget) => (
              <li key={budget.id}>
                <BudgetCard budget={budget} />
              </li>
            ))}
          </Box>
        </>
      )}

      {!yearly && (
        <BudgetFormDialog
          open={formOpen}
          month={period}
          usedCategoryIds={budgets.map((b) => b.categoryId)}
          onClose={() => setFormOpen(false)}
        />
      )}
    </>
  );
}
