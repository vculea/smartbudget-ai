import { Box, Button, Typography } from "@mui/material";
import {
  Plus,
  Wallet,
  PiggyBank,
  Receipt,
  Scale,
  TrendingUp,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useSelectedPeriod } from "../../app/PeriodContext";
import { getErrorMessage } from "../../api";
import { EmptyState } from "../../components/common/EmptyState";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingBlock } from "../../components/common/LoadingBlock";
import { PageHeader } from "../../components/common/PageHeader";
import { PeriodSelector } from "../../components/common/PeriodSelector";
import { StatCard } from "../../components/common/StatCard";
import { formatCurrency } from "../../utils/format";
import { formatPeriodLabel, isYearPeriod, yearOf } from "../../utils/date";
import { BudgetCard } from "./BudgetCard";
import { BudgetFormDialog } from "./BudgetFormDialog";
import { BudgetYearDialog } from "./BudgetYearDialog";
import { IncomePlanCard } from "./IncomePlanCard";
import { useBudgetsQuery, useIncomePlansQuery } from "./hooks";

export function BudgetsPage() {
  const { period } = useSelectedPeriod();
  const yearly = isYearPeriod(period);
  const [formOpen, setFormOpen] = useState(false);
  const { data, isLoading, isError, error, refetch } = useBudgetsQuery(period);
  const incomeQuery = useIncomePlansQuery(period);

  const budgets = data ?? [];
  const incomes = incomeQuery.data ?? [];
  const totalLimit = budgets.reduce((sum, b) => sum + b.limitAmount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spentAmount, 0);
  const plannedIncome = incomes.reduce((sum, i) => sum + i.expectedAmount, 0);

  return (
    <>
      <PageHeader
        title="Bugete"
        subtitle={
          yearly
            ? `Limitele și veniturile planificate, însumate pentru ${formatPeriodLabel(period).toLowerCase()}.`
            : `Limite de cheltuieli și venituri planificate pentru ${formatPeriodLabel(period).toLowerCase()}.`
        }
        actions={
          <>
            <PeriodSelector />
            <Button
              variant="contained"
              startIcon={<Plus size={18} />}
              onClick={() => setFormOpen(true)}
            >
              {yearly ? "Buget anual" : "Buget nou"}
            </Button>
          </>
        }
      />

      {isLoading || incomeQuery.isLoading ? (
        <LoadingBlock rows={3} height={140} />
      ) : isError || incomeQuery.isError ? (
        <ErrorState
          message={getErrorMessage(error ?? incomeQuery.error)}
          onRetry={() => {
            void refetch();
            void incomeQuery.refetch();
          }}
        />
      ) : budgets.length === 0 && incomes.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Niciun buget pentru această perioadă"
          description={
            yearly
              ? "Stabilește limite de cheltuieli și venituri planificate pentru tot anul, manual sau cu ajutorul AI."
              : "Definește limite pe categorii pentru a ține cheltuielile sub control."
          }
          action={
            <Button variant="contained" onClick={() => setFormOpen(true)}>
              {yearly ? "Creează bugetul anual" : "Creează primul buget"}
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
            {incomes.length > 0 && (
              <StatCard
                label="Venituri planificate"
                value={formatCurrency(plannedIncome)}
                icon={TrendingUp}
                tone="green"
              />
            )}
            <StatCard
              label="Total limite"
              value={formatCurrency(totalLimit)}
              icon={PiggyBank}
              tone="indigo"
            />
            {incomes.length > 0 && (
              <StatCard
                label="Sold planificat"
                value={formatCurrency(plannedIncome - totalLimit)}
                icon={Scale}
                tone={plannedIncome - totalLimit >= 0 ? "green" : "red"}
              />
            )}
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
          {budgets.length > 0 && (
            <CardSection title="Cheltuieli">
              {budgets.map((budget) => (
                <li key={budget.id}>
                  <BudgetCard budget={budget} />
                </li>
              ))}
            </CardSection>
          )}
          {incomes.length > 0 && (
            <CardSection title="Venituri planificate">
              {incomes.map((plan) => (
                <li key={plan.id}>
                  <IncomePlanCard plan={plan} />
                </li>
              ))}
            </CardSection>
          )}
        </>
      )}

      {yearly ? (
        <BudgetYearDialog
          open={formOpen}
          year={yearOf(period)}
          onClose={() => setFormOpen(false)}
        />
      ) : (
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

function CardSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Box component="section" aria-label={title} sx={{ mb: 4 }}>
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
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
        {children}
      </Box>
    </Box>
  );
}
