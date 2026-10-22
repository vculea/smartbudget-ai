import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Stack,
  TextField,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, getErrorMessage } from "../../api";
import { addMonthsToDate, todayIso } from "../../utils/date";
import {
  amountField,
  isoDateField,
  parseAmount,
  requiredText,
} from "../../utils/validation";
import { useCreateGoal } from "./hooks";

const schema = z.object({
  name: requiredText("Numele obiectivului"),
  targetAmount: amountField,
  targetDate: isoDateField("Selectează data țintă").refine(
    (value) => value > todayIso(),
    "Data țintă trebuie să fie în viitor",
  ),
});

type FormValues = z.infer<typeof schema>;

export interface GoalFormInitialValues {
  name?: string;
  targetAmount?: number;
  targetDate?: string;
}

interface GoalFormDialogProps {
  open: boolean;
  initialValues?: GoalFormInitialValues;
  onClose: () => void;
  onCreated?: () => void;
}

export function GoalFormDialog({
  open,
  initialValues,
  onClose,
  onCreated,
}: GoalFormDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="goal-dialog-title"
    >
      <DialogTitle id="goal-dialog-title">
        Obiectiv nou de economisire
      </DialogTitle>
      <GoalForm
        initialValues={initialValues}
        onClose={onClose}
        onCreated={onCreated}
      />
    </Dialog>
  );
}

function GoalForm({
  initialValues,
  onClose,
  onCreated,
}: Omit<GoalFormDialogProps, "open">) {
  const create = useCreateGoal();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialValues?.name ?? "",
      targetAmount: initialValues?.targetAmount
        ? String(initialValues.targetAmount)
        : "",
      targetDate: initialValues?.targetDate ?? addMonthsToDate(todayIso(), 6),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        name: values.name.trim(),
        targetAmount: parseAmount(values.targetAmount),
        targetDate: values.targetDate,
      });
      onCreated?.();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        Object.entries(error.fieldErrors).forEach(([field, message]) => {
          if (field in schema.shape)
            setError(field as keyof FormValues, { message });
        });
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {create.isError && (
            <Alert severity="error">{getErrorMessage(create.error)}</Alert>
          )}
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nume obiectiv"
                autoFocus
                required
                error={!!errors.name}
                helperText={errors.name?.message}
              />
            )}
          />
          <Controller
            name="targetAmount"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Suma țintă"
                required
                error={!!errors.targetAmount}
                helperText={errors.targetAmount?.message}
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
          <Controller
            name="targetDate"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                type="date"
                label="Data țintă"
                required
                error={!!errors.targetDate}
                helperText={errors.targetDate?.message}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onClose} disabled={create.isPending}>
          Anulează
        </Button>
        <Button type="submit" variant="contained" disabled={create.isPending}>
          {create.isPending ? "Se salvează..." : "Creează obiectivul"}
        </Button>
      </DialogActions>
    </form>
  );
}
