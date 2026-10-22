import { Box } from "@mui/material";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { palette } from "../../app/theme";
import { SectionCard } from "../../components/common/SectionCard";
import type { MonthlyTrendPoint } from "../../types";
import { formatMonthLabel } from "../../utils/date";
import { formatCompact, formatCurrency } from "../../utils/format";

export function TrendChart({ data }: { data: MonthlyTrendPoint[] }) {
  const chartData = data.map((point) => ({
    ...point,
    label: formatMonthLabel(point.month, "short"),
    fullLabel: formatMonthLabel(point.month),
  }));

  return (
    <SectionCard
      title="Evoluție venituri și cheltuieli"
      subtitle="Ultimele 6 luni"
    >
      <Box
        role="img"
        aria-label={`Grafic cu evoluția veniturilor și cheltuielilor pe ultimele ${data.length} luni`}
        sx={{ height: 300, mt: 1 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={palette.green}
                  stopOpacity={0.28}
                />
                <stop offset="95%" stopColor={palette.green} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={palette.indigo}
                  stopOpacity={0.28}
                />
                <stop offset="95%" stopColor={palette.indigo} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={palette.border}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: palette.muted, fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: palette.muted, fontSize: 12 }}
              tickFormatter={(value: number) => formatCompact(value)}
            />
            <Tooltip
              formatter={(value, name) => [
                formatCurrency(Number(value)),
                String(name),
              ]}
              labelFormatter={(_, payload) =>
                String(payload?.[0]?.payload?.fullLabel ?? "")
              }
              contentStyle={{
                borderRadius: 12,
                border: `1px solid ${palette.border}`,
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ paddingTop: 8 }} />
            <Area
              type="monotone"
              dataKey="income"
              name="Venituri"
              stroke={palette.green}
              strokeWidth={2.5}
              fill="url(#incomeFill)"
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Cheltuieli"
              stroke={palette.indigo}
              strokeWidth={2.5}
              fill="url(#expenseFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </SectionCard>
  );
}
