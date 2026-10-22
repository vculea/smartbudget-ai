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
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, getErrorMessage } from "../../api";
import type { YearMonth } from "../../types";
import { formatMonthLabel } from "../../utils/date";
import { amountField, parseAmount } from "../../utils/validation";
import { useCategories } from "../categories/useCategories";
import { useCreateBudget } from "./hooks";

const schema = z.object({
  categoryId: z.string().min(1, "Selectează o categorie"),
  limitAmount: amountField,
});

type FormValues = z.infer<typeof schema>;

interface BudgetFormDialogProps {
  open: boolean;
  month: YearMonth;
  /** Categoriile care au deja buget în luna selectată. */
  usedCategoryIds: string[];
  onClose: () => void;
}

export function BudgetFormDialog({
  open,
  month,
  usedCategoryIds,
  onClose,
}: BudgetFormDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="budget-dialog-title"
    >
      <DialogTitle id="budget-dialog-title">
        Buget nou · {formatMonthLabel(month)}
      </DialogTitle>
      <BudgetForm
        month={month}
        usedCategoryIds={usedCategoryIds}
        onClose={onClose}
      />
    </Dialog>
  );
}

function BudgetForm({
  month,
  usedCategoryIds,
  onClose,
}: Pick<BudgetFormDialogProps, "month" | "usedCategoryIds" | "onClose">) {
  const { categories, isLoading } = useCategories();
  const create = useCreateBudget();
  const available = categories.filter(
    (c) => c.type === "EXPENSE" && !usedCategoryIds.includes(c.id),
  );

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { categoryId: "", limitAmount: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        categoryId: values.categoryId,
        month,
        limitAmount: parseAmount(values.limitAmount),
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
          {create.isError && (
            <Alert severity="error">{getErrorMessage(create.error)}</Alert>
          )}
          {!isLoading && available.length === 0 && (
            <Alert severity="info">
              Toate categoriile de cheltuieli au deja un buget în această lună.
            </Alert>
          )}
          <Controller
            name="categoryId"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label="Categorie"
                required
                disabled={isLoading || available.length === 0}
                error={!!errors.categoryId}
                helperText={errors.categoryId?.message}
              >
                {available.map((category) => (
                  <MenuItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Controller
            name="limitAmount"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Limită lunară"
                required
                error={!!errors.limitAmount}
                helperText={errors.limitAmount?.message}
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
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onClose} disabled={create.isPending}>
          Anulează
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={create.isPending || available.length === 0}
        >
          {create.isPending ? "Se salvează..." : "Creează bugetul"}
        </Button>
      </DialogActions>
    </form>
  );
}
