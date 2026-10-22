import { Box, IconButton, MenuItem, Select, Stack } from "@mui/material";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSelectedPeriod } from "../../app/PeriodContext";
import type { Period } from "../../types";
import {
  currentMonth,
  formatPeriodLabel,
  isYearPeriod,
  shiftMonth,
  shiftPeriod,
} from "../../utils/date";

const MONTHS_BACK = 23;
const MONTHS_FORWARD = 1;

/** Lunile din interval (cele mai noi primele), fiecare an fiind precedat de opțiunea „Anul YYYY”. */
function buildOptions(selected: Period): Period[] {
  const now = currentMonth();
  const months = Array.from(
    { length: MONTHS_BACK + MONTHS_FORWARD + 1 },
    (_, i) => shiftMonth(now, MONTHS_FORWARD - i),
  );
  const options: Period[] = [];
  const years = new Set<string>();
  for (const month of months) {
    const year = month.slice(0, 4);
    if (!years.has(year)) {
      years.add(year);
      options.push(year);
    }
    options.push(month);
  }
  if (!options.includes(selected)) options.push(selected);
  return options;
}

export function PeriodSelector() {
  const { period, setPeriod } = useSelectedPeriod();
  const yearly = isYearPeriod(period);
  const options = buildOptions(period);

  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        p: 0.5,
      }}
    >
      <IconButton
        size="small"
        aria-label={yearly ? "Anul anterior" : "Luna anterioară"}
        onClick={() => setPeriod(shiftPeriod(period, -1))}
      >
        <ChevronLeft size={18} />
      </IconButton>
      <Box sx={{ minWidth: 150 }}>
        <Select
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          variant="standard"
          disableUnderline
          fullWidth
          inputProps={{ "aria-label": "Selectează perioada" }}
          MenuProps={{ slotProps: { paper: { sx: { maxHeight: 420 } } } }}
          sx={{
            fontWeight: 600,
            "& .MuiSelect-select": { textAlign: "center", py: 0.5 },
          }}
        >
          {options.map((option) => (
            <MenuItem
              key={option}
              value={option}
              sx={isYearPeriod(option) ? { fontWeight: 700 } : undefined}
            >
              {formatPeriodLabel(option)}
            </MenuItem>
          ))}
        </Select>
      </Box>
      <IconButton
        size="small"
        aria-label={yearly ? "Anul următor" : "Luna următoare"}
        onClick={() => setPeriod(shiftPeriod(period, 1))}
      >
        <ChevronRight size={18} />
      </IconButton>
    </Stack>
  );
}
