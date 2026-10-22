import { Typography, type TypographyProps } from "@mui/material";
import type { TransactionType } from "../../types";
import { formatCurrency } from "../../utils/format";

interface TransactionAmountProps extends Omit<TypographyProps, "children"> {
  type: TransactionType;
  amount: number;
}

export function TransactionAmount({
  type,
  amount,
  sx,
  ...rest
}: TransactionAmountProps) {
  const income = type === "INCOME";
  return (
    <Typography
      component="span"
      variant="body2"
      {...rest}
      sx={{
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        color: income ? "success.main" : "text.primary",
        ...sx,
      }}
    >
      {income ? "+" : "−"}
      {formatCurrency(amount)}
    </Typography>
  );
}
