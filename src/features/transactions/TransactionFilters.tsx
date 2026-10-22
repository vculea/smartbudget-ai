import {
  Button,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { Search, X } from "lucide-react";
import type { Category, IsoDate, TransactionType } from "../../types";

export interface TransactionFilterValues {
  search: string;
  type: "" | TransactionType;
  categoryId: "" | number;
  startDate: IsoDate | "";
  endDate: IsoDate | "";
}

export const EMPTY_FILTERS: TransactionFilterValues = {
  search: "",
  type: "",
  categoryId: "",
  startDate: "",
  endDate: "",
};

export const isDateRangeInvalid = (f: TransactionFilterValues) =>
  !!f.startDate && !!f.endDate && f.startDate > f.endDate;

interface TransactionFiltersProps {
  values: TransactionFilterValues;
  categories: Category[];
  onChange: (values: TransactionFilterValues) => void;
}

export function TransactionFilters({
  values,
  categories,
  onChange,
}: TransactionFiltersProps) {
  const patch = (partial: Partial<TransactionFilterValues>) =>
    onChange({ ...values, ...partial });
  const hasFilters = JSON.stringify(values) !== JSON.stringify(EMPTY_FILTERS);
  const rangeInvalid = isDateRangeInvalid(values);
  const visibleCategories = values.type
    ? categories.filter((c) => c.type === values.type)
    : categories;

  return (
    <Stack
      component="form"
      role="search"
      aria-label="Filtre tranzacții"
      onSubmit={(event) => event.preventDefault()}
      direction={{ xs: "column", md: "row" }}
      spacing={1.5}
      alignItems={{ md: "flex-start" }}
      sx={{ p: 2.5 }}
    >
      <TextField
        label="Caută după descriere"
        value={values.search}
        onChange={(event) => patch({ search: event.target.value })}
        sx={{ minWidth: { md: 220 } }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search size={16} />
              </InputAdornment>
            ),
          },
        }}
      />
      <TextField
        select
        label="Tip"
        value={values.type}
        onChange={(event) => {
          const type = event.target.value as "" | TransactionType;
          const keepCategory = categories.some(
            (c) => c.id === values.categoryId && (!type || c.type === type),
          );
          patch({ type, categoryId: keepCategory ? values.categoryId : "" });
        }}
        sx={{ minWidth: { md: 140 } }}
        slotProps={{
          select: { displayEmpty: true },
          inputLabel: { shrink: true },
        }}
      >
        <MenuItem value="">Toate</MenuItem>
        <MenuItem value="INCOME">Venituri</MenuItem>
        <MenuItem value="EXPENSE">Cheltuieli</MenuItem>
      </TextField>
      <TextField
        select
        label="Categorie"
        value={values.categoryId === "" ? "" : String(values.categoryId)}
        onChange={(event) =>
          patch({
            categoryId:
              event.target.value === "" ? "" : Number(event.target.value),
          })
        }
        sx={{ minWidth: { md: 180 } }}
        slotProps={{
          select: { displayEmpty: true },
          inputLabel: { shrink: true },
        }}
      >
        <MenuItem value="">Toate</MenuItem>
        {visibleCategories.map((category) => (
          <MenuItem key={category.id} value={String(category.id)}>
            {category.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        type="date"
        label="De la"
        value={values.startDate}
        onChange={(event) => patch({ startDate: event.target.value })}
        error={rangeInvalid}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        type="date"
        label="Până la"
        value={values.endDate}
        onChange={(event) => patch({ endDate: event.target.value })}
        error={rangeInvalid}
        helperText={
          rangeInvalid ? "Intervalul de date este invalid" : undefined
        }
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <Button
        color="inherit"
        startIcon={<X size={16} />}
        disabled={!hasFilters}
        onClick={() => onChange(EMPTY_FILTERS)}
        sx={{
          whiteSpace: "nowrap",
          flexShrink: 0,
          alignSelf: { xs: "flex-end", md: "flex-start" },
        }}
      >
        Resetează
      </Button>
    </Stack>
  );
}
