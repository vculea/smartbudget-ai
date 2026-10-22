import { Box, Button } from "@mui/material";
import { Plus, Target } from "lucide-react";
import { useState } from "react";
import { getErrorMessage } from "../../api";
import { EmptyState } from "../../components/common/EmptyState";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingBlock } from "../../components/common/LoadingBlock";
import { PageHeader } from "../../components/common/PageHeader";
import type { Goal } from "../../types";
import { ContributionDialog } from "./ContributionDialog";
import { GoalCard } from "./GoalCard";
import { GoalFormDialog } from "./GoalFormDialog";
import { useGoalsQuery } from "./hooks";

export function GoalsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const { data, isLoading, isError, error, refetch } = useGoalsQuery();
  const goals = data ?? [];

  return (
    <>
      <PageHeader
        title="Obiective de economisire"
        subtitle="Stabilește ținte și urmărește progresul către ele."
        actions={
          <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={() => setFormOpen(true)}
          >
            Obiectiv nou
          </Button>
        }
      />

      {isLoading ? (
        <LoadingBlock rows={3} height={170} />
      ) : isError ? (
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nu ai niciun obiectiv încă"
          description="Creează un obiectiv, de exemplu un fond de urgență sau o vacanță."
          action={
            <Button variant="contained" onClick={() => setFormOpen(true)}>
              Creează primul obiectiv
            </Button>
          }
        />
      ) : (
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
          {goals.map((goal) => (
            <li key={goal.id}>
              <GoalCard goal={goal} onContribute={setContributing} />
            </li>
          ))}
        </Box>
      )}

      <GoalFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
      <ContributionDialog
        goal={contributing}
        onClose={() => setContributing(null)}
      />
    </>
  );
}
