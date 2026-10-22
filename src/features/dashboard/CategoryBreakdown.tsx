import { Box, Stack, Typography } from "@mui/material";
import { PieChart as PieIcon } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { EmptyState } from "../../components/common/EmptyState";
import { SectionCard } from "../../components/common/SectionCard";
import type { Category, CategoryExpense } from "../../types";
import { chartColor } from "../../utils/budget";
import { formatCurrency, formatPercent } from "../../utils/format";

interface CategoryBreakdownProps {
  data: CategoryExpense[];
  categoriesById: Map<number, Category>;
}

export function CategoryBreakdown({
  data,
  categoriesById,
}: CategoryBreakdownProps) {
  const items = data.map((item, index) => ({
    ...item,
    color: categoriesById.get(item.categoryId)?.color ?? chartColor(index),
  }));

  return (
    <SectionCard title="Cheltuieli pe categorii" subtitle="Luna selectată">
      {items.length === 0 ? (
        <EmptyState icon={PieIcon} title="Nicio cheltuială în această lună" />
      ) : (
        <>
          <Box
            role="img"
            aria-label="Grafic cu distribuția cheltuielilor pe categorii"
            sx={{ height: 200, mt: 1 }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={items}
                  dataKey="amount"
                  nameKey="categoryName"
                  innerRadius={58}
                  outerRadius={90}
                  paddingAngle={2}
                  stroke="none"
                >
                  {items.map((item) => (
                    <Cell key={item.categoryId} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(Number(value)),
                    String(name),
                  ]}
                  contentStyle={{ borderRadius: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Box>
          <Stack
            component="ul"
            spacing={1}
            sx={{ listStyle: "none", p: 0, m: 0, mt: 1 }}
          >
            {items.slice(0, 6).map((item) => (
              <Stack
                component="li"
                key={item.categoryId}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ minWidth: 0 }}
                >
                  <Box
                    aria-hidden
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: item.color,
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="body2" noWrap>
                    {item.categoryName}
                  </Typography>
                </Stack>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
                >
                  {formatPercent(item.percentage)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </>
      )}
    </SectionCard>
  );
}
