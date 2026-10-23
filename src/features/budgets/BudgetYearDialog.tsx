import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { getErrorMessage } from "../../api";
import type { BudgetPlan, BudgetPlanItem, Category } from "../../types";
import { currentMonth, formatMonthLabel } from "../../utils/date";
import { formatCurrency } from "../../utils/format";
import { amountField, parseAmount } from "../../utils/validation";
import { useCategories } from "../categories/useCategories";
import { useBudgetPlanSuggestion, useCreateYearBudgets } from "./hooks";

const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface BudgetYearDialogProps {
  open: boolean;
  year: number;
  onClose: () => void;
}

export function BudgetYearDialog({ open, year, onClose }: BudgetYearDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="budget-year-dialog-title"
    >
      <DialogTitle id="budget-year-dialog-title">
        Buget anual · {year}
      </DialogTitle>
      <BudgetYearForm year={year} onClose={onClose} />
    </Dialog>
  );
}

/** Suma validă dintr-un câmp, sau 0 dacă e gol / invalid. */
function validAmount(value: string | undefined): number {
  const result = amountField.safeParse(value ?? "");
  return result.success ? parseAmount(result.data) : 0;
}

function BudgetYearForm({ year, onClose }: Omit<BudgetYearDialogProps, "open">) {
  const { categories, isLoading } = useCategories();
  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");
  const incomeCategories = categories.filter((c) => c.type === "INCOME");
  const create = useCreateYearBudgets();
  const suggestion = useBudgetPlanSuggestion();
  const [months, setMonths] = useState<number[]>(ALL_MONTHS);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [plan, setPlan] = useState<BudgetPlan | null>(null);

  const reference = Math.min(year, Number(currentMonth().slice(0, 4)));
  const proposals = new Map(
    [...(plan?.budgets ?? []), ...(plan?.incomes ?? [])].map((b) => [
      b.categoryId,
      b,
    ]),
  );

  const filled = [...expenseCategories, ...incomeCategories].filter(
    (c) => (amounts[c.id] ?? "").trim() !== "",
  );
  const monthlyExpenses = expenseCategories.reduce(
    (sum, c) => sum + validAmount(amounts[c.id]),
    0,
  );
  const monthlyIncome = incomeCategories.reduce(
    (sum, c) => sum + validAmount(amounts[c.id]),
    0,
  );
  const monthlyBalance = monthlyIncome - monthlyExpenses;

  const toggleMonth = (month: number) =>
    setMonths((current) =>
      current.includes(month)
        ? current.filter((m) => m !== month)
        : [...current, month].sort((a, b) => a - b),
    );

  const setAmount = (categoryId: string, value: string) => {
    setAmounts((current) => ({ ...current, [categoryId]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[categoryId];
      return next;
    });
  };

  const suggest = async () => {
    try {
      const result = await suggestion.mutateAsync(year);
      setPlan(result);
      setAmounts((current) => {
        const next = { ...current };
        [...result.budgets, ...result.incomes].forEach((b) => {
          next[b.categoryId] = String(b.monthlyAmount);
        });
        return next;
      });
      setErrors({});
    } catch {
      // Mesajul este afișat din starea mutației.
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const nextErrors: Record<string, string> = {};
    const items = filled.flatMap((c) => {
      const result = amountField.safeParse(amounts[c.id] ?? "");
      if (!result.success) {
        nextErrors[c.id] = result.error.issues[0]?.message ?? "Sumă invalidă";
        return [];
      }
      return [{ categoryId: c.id, limitAmount: parseAmount(result.data) }];
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (months.length === 0) {
      setFormError("Alege cel puțin o lună.");
      return;
    }
    if (items.length === 0) {
      setFormError("Completează suma pentru cel puțin o categorie.");
      return;
    }
    try {
      await create.mutateAsync({ year, months, items });
      onClose();
    } catch {
      // Mesajul este afișat din starea mutației.
    }
  };

  const periodLabel = `${months.length} ${months.length === 1 ? "lună" : "luni"}`;

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogContent>
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary">
            Stabilește o limită lunară pentru cheltuieli și suma lunară pe care
            o aștepți din fiecare venit. Sumele se aplică în lunile alese;
            lunile care au deja o sumă pe acea categorie rămân neschimbate.
          </Typography>

          <Box>
            <Stack
              direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}
            >
              <Typography variant="subtitle2" component="h3">
                Luni
              </Typography>
              <Button
                size="small"
                onClick={() =>
                  setMonths(months.length === 12 ? [] : ALL_MONTHS)
                }
              >
                {months.length === 12 ? "Deselectează tot" : "Toate lunile"}
              </Button>
            </Stack>
            <Box
              role="group"
              aria-label="Luni"
              sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}
            >
              {ALL_MONTHS.map((m) => {
                const label = formatMonthLabel(
                  `${year}-${String(m).padStart(2, "0")}`,
                  "short",
                );
                const selected = months.includes(m);
                return (
                  <Chip
                    key={m}
                    label={label}
                    clickable
                    color={selected ? "primary" : "default"}
                    variant={selected ? "filled" : "outlined"}
                    aria-pressed={selected}
                    onClick={() => toggleMonth(m)}
                  />
                );
              })}
            </Box>
          </Box>

          <Box sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
            >
              <Typography variant="body2" color="text.secondary">
                AI-ul poate completa sumele pe baza mediilor lunare din{" "}
                {reference - 1} și {reference} (doar lunile încheiate). Le poți
                modifica înainte de salvare.
              </Typography>
              <Button
                variant="outlined"
                onClick={() => void suggest()}
                disabled={suggestion.isPending || create.isPending}
                startIcon={
                  suggestion.isPending ? (
                    <CircularProgress size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )
                }
                sx={{ flexShrink: 0 }}
              >
                {suggestion.isPending ? "Se generează..." : "Propune cu AI"}
              </Button>
            </Stack>
            {suggestion.isError && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {getErrorMessage(suggestion.error)}
              </Alert>
            )}
            {plan && !suggestion.isPending && plan.summary && (
              <Alert severity="info" icon={<Sparkles size={18} />} sx={{ mt: 1.5 }}>
                {plan.summary}
              </Alert>
            )}
          </Box>

          {create.isError && (
            <Alert severity="error">{getErrorMessage(create.error)}</Alert>
          )}
          {formError && <Alert severity="warning">{formError}</Alert>}

          <CategorySection
            title="Cheltuieli · limită lunară"
            fieldLabel="Limită lunară"
            emptyText="Nu ai nicio categorie de cheltuieli. Adaug-o din pagina Categorii."
            categories={expenseCategories}
            loading={isLoading}
            amounts={amounts}
            errors={errors}
            proposals={proposals}
            disabled={create.isPending}
            onChange={setAmount}
          />
          <CategorySection
            title="Venituri · sumă lunară așteptată"
            fieldLabel="Venit lunar așteptat"
            emptyText="Nu ai nicio categorie de venit. Adaug-o din pagina Categorii."
            categories={incomeCategories}
            loading={isLoading}
            amounts={amounts}
            errors={errors}
            proposals={proposals}
            disabled={create.isPending}
            onChange={setAmount}
          />

          <Box
            sx={{ p: 2, borderRadius: 2, border: 1, borderColor: "divider" }}
            aria-label="Rezumat buget"
            role="group"
          >
            <SummaryRow
              label="Venituri planificate"
              monthly={monthlyIncome}
              months={months.length}
            />
            <SummaryRow
              label="Limite de cheltuieli"
              monthly={monthlyExpenses}
              months={months.length}
            />
            <Divider sx={{ my: 1 }} />
            <SummaryRow
              label="Sold planificat"
              monthly={monthlyBalance}
              months={months.length}
              strong
              color={monthlyBalance < 0 ? "error.main" : "success.main"}
            />
            <Typography variant="caption" color="text.secondary">
              Pe lună · pe {periodLabel}.
              {monthlyBalance < 0 &&
                " Limitele depășesc veniturile planificate."}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onClose} disabled={create.isPending}>
          Anulează
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={create.isPending || suggestion.isPending}
        >
          {create.isPending ? "Se salvează..." : "Creează bugetele"}
        </Button>
      </DialogActions>
    </form>
  );
}

interface CategorySectionProps {
  title: string;
  fieldLabel: string;
  emptyText: string;
  categories: Category[];
  loading: boolean;
  amounts: Record<string, string>;
  errors: Record<string, string>;
  proposals: Map<string, BudgetPlanItem>;
  disabled: boolean;
  onChange: (categoryId: string, value: string) => void;
}

function CategorySection({
  title,
  fieldLabel,
  emptyText,
  categories,
  loading,
  amounts,
  errors,
  proposals,
  disabled,
  onChange,
}: CategorySectionProps) {
  return (
    <Box component="section" aria-label={title}>
      <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {!loading && categories.length === 0 && (
        <Alert severity="info">{emptyText}</Alert>
      )}
      <Stack divider={<Divider flexItem />} spacing={1.5}>
        {categories.map((category) => {
          const proposal = proposals.get(category.id);
          return (
            <Stack
              key={category.id}
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ alignItems: { sm: "center" } }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {category.name}
                </Typography>
                {proposal && (
                  <>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="p"
                    >
                      {proposal.history
                        .map(
                          (h) =>
                            `Medie ${h.year}: ${formatCurrency(h.monthlyAverage)}`,
                        )
                        .join(" · ")}
                    </Typography>
                    {proposal.reason && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="p"
                      >
                        {proposal.reason}
                      </Typography>
                    )}
                  </>
                )}
              </Box>
              <TextField
                size="small"
                value={amounts[category.id] ?? ""}
                onChange={(e) => onChange(category.id, e.target.value)}
                error={!!errors[category.id]}
                helperText={errors[category.id]}
                disabled={disabled}
                sx={{ width: { xs: "100%", sm: 180 }, flexShrink: 0 }}
                slotProps={{
                  htmlInput: {
                    inputMode: "decimal",
                    placeholder: "—",
                    "aria-label": `${fieldLabel} ${category.name}`,
                  },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">lei</InputAdornment>
                    ),
                  },
                }}
              />
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

function SummaryRow({
  label,
  monthly,
  months,
  strong,
  color,
}: {
  label: string;
  monthly: number;
  months: number;
  strong?: boolean;
  color?: string;
}) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
      <Typography variant="body2" sx={{ fontWeight: strong ? 700 : 400 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: strong ? 700 : 500,
          fontVariantNumeric: "tabular-nums",
          color,
        }}
      >
        {formatCurrency(monthly)} · {formatCurrency(monthly * months)}
      </Typography>
    </Stack>
  );
}
