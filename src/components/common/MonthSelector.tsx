import { Box, IconButton, MenuItem, Select, Stack } from "@mui/material";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSelectedMonth } from "../../app/MonthContext";
import { currentMonth, formatMonthLabel, shiftMonth } from "../../utils/date";

const MONTHS_BACK = 23;
const MONTHS_FORWARD = 1;

export function MonthSelector() {
  const { month, setMonth } = useSelectedMonth();
  const now = currentMonth();
  const options = Array.from(
    { length: MONTHS_BACK + MONTHS_FORWARD + 1 },
    (_, i) => shiftMonth(now, MONTHS_FORWARD - i),
  );
  if (!options.includes(month)) options.push(month);

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
        aria-label="Luna anterioară"
        onClick={() => setMonth(shiftMonth(month, -1))}
      >
        <ChevronLeft size={18} />
      </IconButton>
      <Box sx={{ minWidth: 150 }}>
        <Select
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          variant="standard"
          disableUnderline
          fullWidth
          inputProps={{ "aria-label": "Selectează luna" }}
          sx={{
            fontWeight: 600,
            "& .MuiSelect-select": { textAlign: "center", py: 0.5 },
          }}
        >
          {options.map((option) => (
            <MenuItem key={option} value={option}>
              {formatMonthLabel(option)}
            </MenuItem>
          ))}
        </Select>
      </Box>
      <IconButton
        size="small"
        aria-label="Luna următoare"
        onClick={() => setMonth(shiftMonth(month, 1))}
      >
        <ChevronRight size={18} />
      </IconButton>
    </Stack>
  );
}
