import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from "@mui/material";
import type { ChangeEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, getErrorMessage } from "../../api";
import type { Category, TransactionType } from "../../types";
import { requiredText } from "../../utils/validation";
import { useSaveCategory } from "./hooks";

export const CATEGORY_COLORS = [
  "#4f46e5",
  "#0ea5e9",
  "#14b8a6",
  "#10b981",
  "#84cc16",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#a855f7",
  "#64748b",
];

const schema = z.object({
  name: requiredText("Numele", 50),
  type: z.enum(["EXPENSE", "INCOME"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Alege o culoare"),
});

type FormValues = z.infer<typeof schema>;

interface CategoryFormDialogProps {
  open: boolean;
  /** Categoria editată; lipsește când se creează una nouă. */
  category?: Category | null;
  defaultType?: TransactionType;
  onClose: () => void;
}

export function CategoryFormDialog({
  open,
  category,
  defaultType = "EXPENSE",
  onClose,
}: CategoryFormDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="category-dialog-title"
    >
      <DialogTitle id="category-dialog-title">
        {category ? "Editează categoria" : "Categorie nouă"}
      </DialogTitle>
      <CategoryForm
        key={category?.id ?? "new"}
        category={category}
        defaultType={defaultType}
        onClose={onClose}
      />
    </Dialog>
  );
}

function CategoryForm({
  category,
  defaultType,
  onClose,
}: Omit<CategoryFormDialogProps, "open">) {
  const save = useSaveCategory();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? "",
      type: category?.type ?? defaultType,
      color: category?.color ?? CATEGORY_COLORS[0],
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: category?.id,
        input: {
          name: values.name.trim(),
          type: values.type,
          color: values.color,
          icon: category?.icon ?? null,
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
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nume categorie"
                autoFocus
                required
                error={!!errors.name}
                helperText={errors.name?.message}
              />
            )}
          />
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <FormControl>
                <FormLabel id="category-type-label">Tip</FormLabel>
                <RadioGroup
                  {...field}
                  row
                  aria-labelledby="category-type-label"
                >
                  <FormControlLabel
                    value="EXPENSE"
                    control={<Radio />}
                    label="Cheltuială"
                  />
                  <FormControlLabel
                    value="INCOME"
                    control={<Radio />}
                    label="Venit"
                  />
                </RadioGroup>
              </FormControl>
            )}
          />
          <Controller
            name="color"
            control={control}
            render={({ field }) => (
              <FormControl error={!!errors.color}>
                <FormLabel id="category-color-label">Culoare</FormLabel>
                <Box
                  role="radiogroup"
                  aria-labelledby="category-color-label"
                  sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}
                >
                  {CATEGORY_COLORS.map((color) => {
                    const selected =
                      field.value.toLowerCase() === color.toLowerCase();
                    return (
                      <Box
                        key={color}
                        component="button"
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`Culoare ${color}`}
                        onClick={() => field.onChange(color)}
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          bgcolor: color,
                          cursor: "pointer",
                          border: "2px solid",
                          borderColor: selected ? "text.primary" : "transparent",
                          outline: selected ? "2px solid" : "none",
                          outlineColor: "background.paper",
                          outlineOffset: -4,
                          p: 0,
                        }}
                      />
                    );
                  })}
                  <Box
                    component="input"
                    type="color"
                    aria-label="Altă culoare"
                    value={field.value}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      field.onChange(e.target.value)
                    }
                    sx={{
                      width: 28,
                      height: 28,
                      p: 0,
                      border: "none",
                      bgcolor: "transparent",
                      cursor: "pointer",
                    }}
                  />
                </Box>
              </FormControl>
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onClose} disabled={save.isPending}>
          Anulează
        </Button>
        <Button type="submit" variant="contained" disabled={save.isPending}>
          {save.isPending
            ? "Se salvează..."
            : category
              ? "Salvează"
              : "Adaugă categoria"}
        </Button>
      </DialogActions>
    </form>
  );
}
