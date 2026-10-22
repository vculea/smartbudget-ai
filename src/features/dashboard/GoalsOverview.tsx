import { Box, Button, Stack, Typography } from "@mui/material";
import { Target } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/common/EmptyState";
import { ProgressBar } from "../../components/common/ProgressBar";
import { SectionCard } from "../../components/common/SectionCard";
import type { Goal } from "../../types";
import { formatCurrency, formatPercent } from "../../utils/format";
import { GoalStatusChip, goalProgressTone } from "../goals/GoalStatusChip";

export function GoalsOverview({ goals }: { goals: Goal[] }) {
  const visible = [...goals]
    .sort(
      (a, b) =>
        Number(a.status === "COMPLETED") - Number(b.status === "COMPLETED"),
    )
    .slice(0, 4);

  return (
    <SectionCard
      title="Obiective de economisire"
      subtitle="Progresul către țintele tale"
      action={
        <Button component={Link} to="/goals" size="small">
          Vezi toate
        </Button>
      }
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Niciun obiectiv definit"
          description="Stabilește un obiectiv pentru a începe să economisești."
        />
      ) : (
        <Stack
          component="ul"
          spacing={2.5}
          sx={{ listStyle: "none", p: 0, m: 0 }}
        >
          {visible.map((goal) => (
            <Box component="li" key={goal.id}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 0.75 }}
                spacing={1}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {goal.name}
                </Typography>
                <GoalStatusChip status={goal.status} />
              </Stack>
              <ProgressBar
                value={goal.progressPercentage}
                tone={goalProgressTone(goal.status)}
                height={8}
                label={`${goal.name}: ${formatPercent(goal.progressPercentage)} din obiectiv`}
              />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">
                  {formatCurrency(goal.currentAmount)} din{" "}
                  {formatCurrency(goal.targetAmount)}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {formatPercent(goal.progressPercentage)}
                </Typography>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}
