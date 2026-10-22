import { Box } from "@mui/material";
import { PiggyBank, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { StatCard } from "../../components/common/StatCard";
import type { DashboardResponse } from "../../types";
import { formatCurrency, formatPercent } from "../../utils/format";

export function SummaryCards({ data }: { data: DashboardResponse }) {
  return (
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
      <StatCard
        label="Venituri"
        value={formatCurrency(data.totalIncome)}
        icon={TrendingUp}
        tone="green"
      />
      <StatCard
        label="Cheltuieli"
        value={formatCurrency(data.totalExpenses)}
        icon={TrendingDown}
        tone="red"
      />
      <StatCard
        label="Sold lunar"
        value={formatCurrency(data.balance)}
        icon={Wallet}
        tone={data.balance >= 0 ? "indigo" : "red"}
        caption="Venituri minus cheltuieli"
      />
      <StatCard
        label="Rata de economisire"
        value={formatPercent(data.savingsRate, 1)}
        icon={PiggyBank}
        tone="violet"
        caption="Din veniturile lunii"
      />
    </Box>
  );
}
