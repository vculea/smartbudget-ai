import { Box, Button } from "@mui/material";
import { Plus, Wallet, PiggyBank, Receipt, Scale } from "lucide-react";
import { useState } from "react";
import { useSelectedMonth } from "../../app/MonthContext";
import { getErrorMessage } from "../../api";
import { EmptyState } from "../../components/common/EmptyState";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingBlock } from "../../components/common/LoadingBlock";
import { MonthSelector } from "../../components/common/MonthSelector";
import { PageHeader } from "../../components/common/PageHeader";
import { StatCard } from "../../components/common/StatCard";
import { formatCurrency } from "../../utils/format";
import { formatMonthLabel } from "../../utils/date";
import { BudgetCard } from "./BudgetCard";
import { BudgetFormDialog } from "./BudgetFormDialog";
import { useBudgetsQuery } from "./hooks";

export function BudgetsPage() {
  const { month } = useSelectedMonth();
  const [formOpen, setFormOpen] = useState(false);
  const { data, isLoading, isError, error, refetch } = useBudgetsQuery(month);

  const budgets = data ?? [];
  const totalLimit = budgets.reduce((sum, b) => sum + b.limitAmount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spentAmount, 0);

  return (
    <>
      <PageHeader
        title="Bugete"
        subtitle={`Limite de cheltuieli pentru ${formatMonthLabel(month).toLowerCase()}.`}
        actions={
          <>
            <MonthSelector />
            <Button
              variant="contained"
              startIcon={<Plus size={18} />}
              onClick={() => setFormOpen(true)}
            >
              Buget nou
            </Button>
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
          title="Niciun buget pentru această lună"
          description="Definește limite pe categorii pentru a ține cheltuielile sub control."
          action={
            <Button variant="contained" onClick={() => setFormOpen(true)}>
              Creează primul buget
            </Button>
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

      <BudgetFormDialog
        open={formOpen}
        month={month}
        usedCategoryIds={budgets.map((b) => b.categoryId)}
        onClose={() => setFormOpen(false)}
      />
    </>
  );
}
