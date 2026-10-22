import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import { CalendarDays, PlusCircle } from "lucide-react";
import type { Goal } from "../../types";
import { daysUntil, formatDate } from "../../utils/date";
import { formatCurrency, formatPercent } from "../../utils/format";
import { getGoalDisplayStatus } from "../../utils/goal";
import { ProgressBar } from "../../components/common/ProgressBar";
import { GoalStatusChip, goalProgressTone } from "./GoalStatusChip";

interface GoalCardProps {
  goal: Goal;
  onContribute: (goal: Goal) => void;
}

function deadlineText(goal: Goal): string {
  if (!goal.targetDate) return "Fără termen stabilit";
  if (goal.status === "COMPLETED")
    return `Termen: ${formatDate(goal.targetDate)}`;
  const days = daysUntil(goal.targetDate);
  if (days < 0) return `Termenul a trecut acum ${Math.abs(days)} zile`;
  if (days === 0) return "Termenul este astăzi";
  return `${formatDate(goal.targetDate)} · ${days} zile rămase`;
}

export function GoalCard({ goal, onContribute }: GoalCardProps) {
  const completed = goal.status === "COMPLETED";
  const displayStatus = getGoalDisplayStatus(goal);
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

  return (
    <Card
      component="article"
      aria-label={`Obiectiv ${goal.name}`}
      sx={{ height: "100%" }}
    >
      <CardContent
        sx={{ p: 3, display: "flex", flexDirection: "column", height: "100%" }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Typography component="h3" variant="subtitle1">
            {goal.name}
          </Typography>
          <GoalStatusChip status={displayStatus} />
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
            {formatCurrency(goal.currentAmount)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            din {formatCurrency(goal.targetAmount)}
          </Typography>
        </Stack>

        <ProgressBar
          value={goal.progressPercentage}
          tone={goalProgressTone(displayStatus)}
          label={`${goal.name}: ${formatPercent(goal.progressPercentage)} din obiectiv`}
        />

        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {formatPercent(goal.progressPercentage)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {completed
              ? "Obiectiv atins"
              : `Mai ai de strâns ${formatCurrency(remaining)}`}
          </Typography>
        </Stack>

        <Box sx={{ mt: "auto", pt: 2.5 }}>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ color: "text.secondary", mb: 2 }}
          >
            <CalendarDays size={16} aria-hidden />
            <Typography variant="body2">{deadlineText(goal)}</Typography>
          </Stack>
          <Button
            fullWidth
            variant={completed ? "outlined" : "contained"}
            startIcon={<PlusCircle size={18} />}
            disabled={completed}
            onClick={() => onContribute(goal)}
            aria-label={`Adaugă contribuție la ${goal.name}`}
          >
            Adaugă contribuție
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
