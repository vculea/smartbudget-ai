import {
  Button,
  Card,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import type { ImportColumnMapping } from "../../../types";
import { DESCRIPTION_MAX, describeColumns, type Cell } from "./importParser";

const NONE = "";

interface ColumnMappingCardProps {
  rows: Cell[][];
  fileName: string;
  busy: boolean;
  onConfirm: (mapping: ImportColumnMapping, defaultDescription: string) => void;
  onCancel: () => void;
}

/** Alegerea manuală a coloanelor, când recunoașterea automată a eșuat. */
export function ColumnMappingCard({
  rows,
  fileName,
  busy,
  onConfirm,
  onCancel,
}: ColumnMappingCardProps) {
  const { headerRow, columns } = useMemo(() => describeColumns(rows), [rows]);
  const [date, setDate] = useState(NONE);
  const [description, setDescription] = useState(NONE);
  const [amount, setAmount] = useState(NONE);
  const [defaultDescription, setDefaultDescription] = useState("");

  const needsDefault = description === NONE;
  const canConfirm =
    date !== NONE &&
    amount !== NONE &&
    (!needsDefault || defaultDescription.trim() !== "");

  const column = (value: string) => (value === NONE ? null : Number(value));
  const options = columns.map((c) => (
    <MenuItem key={c.index} value={String(c.index)}>
      {c.label}
    </MenuItem>
  ));

  return (
    <Card sx={{ p: 2 }}>
      <Stack spacing={2} sx={{ maxWidth: 560 }}>
        <Typography variant="h6">Alege coloanele din {fileName}</Typography>
        <Typography variant="body2" color="text.secondary">
          Spune-mi ce conține fiecare coloană. Poți corecta totul în pasul
          următor, înainte de salvare.
        </Typography>
        <TextField
          select
          required
          label="Coloana cu data"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        >
          {options}
        </TextField>
        <TextField
          select
          required
          label="Coloana cu suma"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        >
          {options}
        </TextField>
        <TextField
          select
          label="Coloana cu descrierea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        >
          <MenuItem value={NONE}>Nu am – folosesc același text</MenuItem>
          {options}
        </TextField>
        {needsDefault && (
          <TextField
            required
            label="Descrierea tranzacțiilor"
            placeholder="ex.: Rată credit"
            value={defaultDescription}
            onChange={(e) => setDefaultDescription(e.target.value)}
            slotProps={{ htmlInput: { maxLength: DESCRIPTION_MAX } }}
          />
        )}
        <Stack direction="row" spacing={1.5} justifyContent="flex-end">
          <Button onClick={onCancel}>Alege alt fișier</Button>
          <Button
            variant="contained"
            disabled={!canConfirm || busy}
            onClick={() =>
              onConfirm(
                {
                  headerRow,
                  date: column(date),
                  amount: column(amount),
                  description: column(description),
                  dateFormat: "DMY",
                },
                defaultDescription,
              )
            }
          >
            Continuă
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}
