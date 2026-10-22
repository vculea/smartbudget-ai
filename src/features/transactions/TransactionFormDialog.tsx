import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, getErrorMessage } from "../../api";
import type { Transaction, TransactionType } from "../../types";
import { todayIso } from "../../utils/date";
import {
  amountField,
  isoDateField,
  parseAmount,
  requiredText,
} from "../../utils/validation";
import { useCategories } from "../categories/useCategories";
import { useSaveTransaction } from "./hooks";

const schema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: amountField,
  description: requiredText("Descrierea"),
  transactionDate: isoDateField("Selectează data tranzacției"),
  categoryId: z.string().min(1, "Selectează o categorie"),
});

type FormValues = z.infer<typeof schema>;

interface TransactionFormDialogProps {
  open: boolean;
  /** Dacă este setată, dialogul editează tranzacția. */
  transaction?: Transaction | null;
  onClose: () => void;
}

export function TransactionFormDialog({
  open,
  transaction,
  onClose,
}: TransactionFormDialogProps) {
  const isEdit = !!transaction;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="transaction-dialog-title"
    >
      <DialogTitle id="transaction-dialog-title">
        {isEdit ? "Editează tranzacția" : "Tranzacție nouă"}
      </DialogTitle>
      <TransactionForm transaction={transaction ?? null} onClose={onClose} />
    </Dialog>
  );
}

function TransactionForm({
  transaction,
  onClose,
}: {
  transaction: Transaction | null;
  onClose: () => void;
}) {
  const {
    categories,
    isLoading: categoriesLoading,
    isError: categoriesError,
  } = useCategories();
  const save = useSaveTransaction();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: transaction?.type ?? "EXPENSE",
      amount: transaction ? String(transaction.amount) : "",
      description: transaction?.description ?? "",
      transactionDate: transaction?.transactionDate ?? todayIso(),
      categoryId: transaction ? String(transaction.categoryId) : "",
    },
  });

  const type = watch("type");
  const categoryId = watch("categoryId");
  const availableCategories = categories.filter((c) => c.type === type);

  // O categorie care nu aparține tipului ales se golește.
  useEffect(() => {
    if (
      categoryId &&
      categories.length > 0 &&
      !availableCategories.some((c) => String(c.id) === categoryId)
    ) {
      setValue("categoryId", "");
    }
  }, [type, categories, categoryId, availableCategories, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: transaction?.id,
        input: {
          type: values.type,
          amount: parseAmount(values.amount),
          description: values.description.trim(),
          transactionDate: values.transactionDate,
          categoryId: values.categoryId,
        },
      });
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
          {save.isError && (
            <Alert severity="error">{getErrorMessage(save.error)}</Alert>
          )}
          {categoriesError && (
            <Alert severity="error">
              Categoriile nu au putut fi încărcate.
            </Alert>
          )}

          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                color="primary"
                value={field.value}
                aria-label="Tip tranzacție"
                onChange={(_, value: TransactionType | null) =>
                  value && field.onChange(value)
                }
              >
                <ToggleButton value="EXPENSE">Cheltuială</ToggleButton>
                <ToggleButton value="INCOME">Venit</ToggleButton>
              </ToggleButtonGroup>
            )}
          />

          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Sumă"
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

          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Descriere"
                required
                error={!!errors.description}
                helperText={errors.description?.message}
              />
            )}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Categorie"
                  required
                  disabled={categoriesLoading}
                  error={!!errors.categoryId}
                  helperText={errors.categoryId?.message}
                >
                  {availableCategories.map((category) => (
                    <MenuItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="transactionDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Data"
                  required
                  error={!!errors.transactionDate}
                  helperText={errors.transactionDate?.message}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              )}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onClose} disabled={save.isPending}>
          Anulează
        </Button>
        <Button type="submit" variant="contained" disabled={save.isPending}>
          {save.isPending
            ? "Se salvează..."
            : transaction
              ? "Salvează modificările"
              : "Adaugă tranzacția"}
        </Button>
      </DialogActions>
    </form>
  );
}
