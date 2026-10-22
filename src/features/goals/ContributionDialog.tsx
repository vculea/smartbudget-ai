import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  InputAdornment,
  TextField,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { getErrorMessage } from "../../api";
import type { Goal } from "../../types";
import { formatCurrency } from "../../utils/format";
import { amountField, parseAmount } from "../../utils/validation";
import { useAddContribution } from "./hooks";

const schema = z.object({ amount: amountField });
type FormValues = z.infer<typeof schema>;

interface ContributionDialogProps {
  goal: Goal | null;
  onClose: () => void;
}

export function ContributionDialog({ goal, onClose }: ContributionDialogProps) {
  return (
    <Dialog
      open={!!goal}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="contribution-dialog-title"
    >
      <DialogTitle id="contribution-dialog-title">
        Adaugă contribuție
      </DialogTitle>
      {goal && <ContributionForm goal={goal} onClose={onClose} />}
    </Dialog>
  );
}

function ContributionForm({
  goal,
  onClose,
}: {
  goal: Goal;
  onClose: () => void;
}) {
  const mutation = useAddContribution();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "" },
  });

  const onSubmit = handleSubmit(async ({ amount }) => {
    try {
      await mutation.mutateAsync({
        goalId: goal.id,
        input: { amount: parseAmount(amount) },
      });
      onClose();
    } catch {
      // Eroarea este afișată în dialog și prin toast.
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogContent>
        <DialogContentText sx={{ mb: 2.5 }}>
          {goal.name} · mai ai de strâns{" "}
          {formatCurrency(Math.max(0, goal.targetAmount - goal.currentAmount))}
        </DialogContentText>
        {mutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {getErrorMessage(mutation.error)}
          </Alert>
        )}
        <Controller
          name="amount"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Sumă contribuție"
              autoFocus
              required
              error={!!errors.amount}
              helperText={errors.amount?.message}
              slotProps={{
                htmlInput: { inputMode: "decimal" },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">RON</InputAdornment>
                  ),
                },
              }}
            />
          )}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onClose} disabled={mutation.isPending}>
          Anulează
        </Button>
        <Button type="submit" variant="contained" disabled={mutation.isPending}>
          {mutation.isPending ? "Se salvează..." : "Adaugă"}
        </Button>
      </DialogActions>
    </form>
  );
}
