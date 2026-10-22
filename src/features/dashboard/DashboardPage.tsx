import { Box, Grid, Skeleton } from "@mui/material";
import { useSelectedMonth } from "../../app/MonthContext";
import { getErrorMessage } from "../../api";
import { ErrorState } from "../../components/common/ErrorState";
import { MonthSelector } from "../../components/common/MonthSelector";
import { PageHeader } from "../../components/common/PageHeader";
import { formatMonthLabel } from "../../utils/date";
import { useCategories } from "../categories/useCategories";
import { AiPromoCard } from "./AiPromoCard";
import { BudgetsOverview } from "./BudgetsOverview";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { GoalsOverview } from "./GoalsOverview";
import { useDashboardQuery } from "./hooks";
import { RecentTransactions } from "./RecentTransactions";
import { SummaryCards } from "./SummaryCards";
import { TrendChart } from "./TrendChart";

function DashboardSkeleton() {
  return (
    <Box role="status" aria-label="Se încarcă dashboardul">
      <Box
        sx={{
          display: "grid",
          gap: 2.5,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
          },
        }}
      >
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={104} animation="wave" />
        ))}
      </Box>
      <Grid container spacing={3} sx={{ mt: 0 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Skeleton variant="rounded" height={380} animation="wave" />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Skeleton variant="rounded" height={380} animation="wave" />
        </Grid>
      </Grid>
    </Box>
  );
}

export function DashboardPage() {
  const { month } = useSelectedMonth();
  const { data, isLoading, isError, error, refetch } = useDashboardQuery(month);
  const { byId } = useCategories();

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Situația financiară pentru ${formatMonthLabel(month).toLowerCase()}.`}
        actions={<MonthSelector />}
      />

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError || !data ? (
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : (
        <Box sx={{ display: "grid", gap: 3 }}>
          <SummaryCards data={data} />
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <TrendChart data={data.monthlyTrend} />
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <CategoryBreakdown
                data={data.expensesByCategory}
                categoriesById={byId}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <BudgetsOverview budgets={data.budgets} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <GoalsOverview goals={data.goals} />
            </Grid>
            <Grid size={{ xs: 12, lg: 8 }}>
              <RecentTransactions
                transactions={data.recentTransactions}
                categoriesById={byId}
              />
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <AiPromoCard />
            </Grid>
          </Grid>
        </Box>
      )}
    </>
  );
}
