import {
  Alert,
  Box,
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { z } from "zod";
import type {
  Category,
  TransactionInput,
  TransactionScan,
  TransactionType,
} from "../../types";
import {
  amountField,
  isoDateField,
  parseAmount,
  requiredText,
} from "../../utils/validation";
import { useImportTransactions } from "./hooks";

const DESCRIPTION_MAX = 120;

const rowSchema = z.object({
  amount: amountField,
  description: requiredText("Descrierea"),
  transactionDate: isoDateField("Selectează data"),
  categoryId: z.string().min(1, "Alege categoria"),
});

type RowField = keyof z.infer<typeof rowSchema>;

interface Row {
  key: number;
  selected: boolean;
  type: TransactionType;
  amount: string;
  description: string;
  transactionDate: string;
  categoryId: string;
  suggestedCategoryId: string | null;
}

function toRow(scan: TransactionScan, key: number): Row {
  return {
    key,
    selected: true,
    type: scan.type,
    amount: scan.amount === null ? "" : String(scan.amount),
    description: scan.description.slice(0, DESCRIPTION_MAX),
    transactionDate: scan.transactionDate,
    categoryId: scan.categoryId ?? "",
    suggestedCategoryId: scan.categoryId,
  };
}

function rowErrors(row: Row): Partial<Record<RowField, string>> {
  const result = rowSchema.safeParse(row);
  if (result.success) return {};
  const errors: Partial<Record<RowField, string>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as RowField;
    errors[field] ??= issue.message;
  }
  return errors;
}

const savedMessage = (created: number) =>
  created === 1
    ? "S-a adăugat o tranzacție."
    : `S-au adăugat ${created} tranzacții.`;

interface ScannedTransactionsReviewProps {
  scans: TransactionScan[];
  categories: Category[];
  categoriesLoading: boolean;
  /** Renunță la lista citită și revine la formularul simplu. */
  onBack: () => void;
  onSaved: () => void;
}

/** Tranzacțiile găsite într-o poză (ex. extras de cont): utilizatorul le bifează, le corectează și le salvează deodată. */
export function ScannedTransactionsReview({
  scans,
  categories,
  categoriesLoading,
  onBack,
  onSaved,
}: ScannedTransactionsReviewProps) {
  const [rows, setRows] = useState(() => scans.map(toRow));
  const [submitted, setSubmitted] = useState(false);
  const save = useImportTransactions(savedMessage);

  const selected = rows.filter((row) => row.selected);
  const allSelected = selected.length === rows.length;

  const update = (key: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        // Categoria rămâne doar dacă aparține noului tip.
        if (
          patch.type &&
          !categories.some((c) => c.id === next.categoryId && c.type === next.type)
        ) {
          next.categoryId = "";
        }
        return next;
      }),
    );

  const handleSave = async () => {
    setSubmitted(true);
    if (selected.length === 0) return;
    if (selected.some((row) => Object.keys(rowErrors(row)).length > 0)) return;
    const inputs: TransactionInput[] = selected.map((row) => ({
      type: row.type,
      amount: parseAmount(row.amount),
      description: row.description.trim(),
      transactionDate: row.transactionDate,
      categoryId: row.categoryId,
    }));
    const lessons = selected.map((row) => ({
      description: row.description.trim(),
      type: row.type,
      categoryId: row.categoryId,
      corrected:
        !!row.suggestedCategoryId && row.suggestedCategoryId !== row.categoryId,
    }));
    try {
      await save.mutateAsync({ inputs, lessons });
      onSaved();
    } catch {
      // Eroarea este afișată din starea mutației.
    }
  };

  return (
    <>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            Am găsit {rows.length} tranzacții în poză. Bifează-le pe cele pe
            care vrei să le salvezi, verifică-le și corectează ce nu este bun.
          </Alert>
          {save.isError && (
            <Alert severity="error">
              Tranzacțiile nu au putut fi salvate. Încearcă din nou.
            </Alert>
          )}
          {submitted && selected.length === 0 && (
            <Alert severity="warning">Bifează cel puțin o tranzacție.</Alert>
          )}

          <Stack direction="row" alignItems="center">
            <Checkbox
              checked={allSelected}
              indeterminate={selected.length > 0 && !allSelected}
              onChange={(event) =>
                setRows((current) =>
                  current.map((row) => ({
                    ...row,
                    selected: event.target.checked,
                  })),
                )
              }
              slotProps={{ input: { "aria-label": "Selectează toate" } }}
            />
            <Typography variant="body2" color="text.secondary">
              {selected.length} din {rows.length} selectate
            </Typography>
          </Stack>

          {rows.map((row, index) => {
            const errors = submitted && row.selected ? rowErrors(row) : {};
            const label = `Tranzacția ${index + 1}`;
            const options = categories.filter((c) => c.type === row.type);
            return (
              <Box
                key={row.key}
                role="group"
                aria-label={label}
                data-testid="scanned-transaction"
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 1.5,
                  opacity: row.selected ? 1 : 0.6,
                }}
              >
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Checkbox
                      checked={row.selected}
                      onChange={(event) =>
                        update(row.key, { selected: event.target.checked })
                      }
                      slotProps={{ input: { "aria-label": `Salvează ${label}` } }}
                      sx={{ mt: 0.5 }}
                    />
                    <TextField
                      label="Descriere"
                      size="small"
                      fullWidth
                      value={row.description}
                      onChange={(event) =>
                        update(row.key, { description: event.target.value })
                      }
                      error={!!errors.description}
                      helperText={errors.description}
                      slotProps={{ htmlInput: { maxLength: DESCRIPTION_MAX } }}
                    />
                    <TextField
                      label="Sumă"
                      size="small"
                      value={row.amount}
                      onChange={(event) =>
                        update(row.key, { amount: event.target.value })
                      }
                      error={!!errors.amount}
                      helperText={errors.amount}
                      sx={{ width: 150, flexShrink: 0 }}
                      slotProps={{
                        htmlInput: { inputMode: "decimal" },
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">lei</InputAdornment>
                          ),
                        },
                      }}
                    />
                  </Stack>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{ pl: { sm: 6 } }}
                  >
                    <TextField
                      select
                      label="Tip"
                      size="small"
                      value={row.type}
                      onChange={(event) =>
                        update(row.key, {
                          type: event.target.value as TransactionType,
                        })
                      }
                      sx={{ minWidth: 130 }}
                    >
                      <MenuItem value="EXPENSE">Cheltuială</MenuItem>
                      <MenuItem value="INCOME">Venit</MenuItem>
                    </TextField>
                    <TextField
                      select
                      label="Categorie"
                      size="small"
                      fullWidth
                      disabled={categoriesLoading}
                      value={row.categoryId}
                      onChange={(event) =>
                        update(row.key, { categoryId: event.target.value })
                      }
                      error={!!errors.categoryId}
                      helperText={errors.categoryId}
                    >
                      {options.map((category) => (
                        <MenuItem key={category.id} value={String(category.id)}>
                          {category.name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      type="date"
                      label="Data"
                      size="small"
                      value={row.transactionDate}
                      onChange={(event) =>
                        update(row.key, { transactionDate: event.target.value })
                      }
                      error={!!errors.transactionDate}
                      helperText={errors.transactionDate}
                      sx={{ minWidth: 160 }}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  </Stack>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onBack} disabled={save.isPending}>
          Înapoi la formular
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={save.isPending}
        >
          {save.isPending
            ? "Se salvează..."
            : selected.length === 1
              ? "Adaugă tranzacția"
              : `Adaugă ${selected.length} tranzacții`}
        </Button>
      </DialogActions>
    </>
  );
}
