const LOCALE = "ro-RO";

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "RON",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeCurrencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "RON",
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat(LOCALE, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatCurrency = (value: number): string =>
  currencyFormatter.format(value);

export const formatCurrencyRounded = (value: number): string =>
  wholeCurrencyFormatter.format(value);

export const formatCompact = (value: number): string =>
  compactFormatter.format(value);

export function formatPercent(value: number, fractionDigits = 0): string {
  return `${new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)}%`;
}

export const clampPercent = (value: number): number =>
  Math.min(100, Math.max(0, value));
