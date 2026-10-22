import type { IsoDate, YearMonth } from "../types";

const LOCALE = "ro-RO";

const pad = (n: number) => String(n).padStart(2, "0");

export function toIsoDate(date: Date): IsoDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(): IsoDate {
  return toIsoDate(new Date());
}

export function currentMonth(): YearMonth {
  return todayIso().slice(0, 7);
}

function parseMonth(month: YearMonth): { year: number; monthIndex: number } {
  const [year, m] = month.split("-").map(Number);
  return { year: year ?? 1970, monthIndex: (m ?? 1) - 1 };
}

export function shiftMonth(month: YearMonth, delta: number): YearMonth {
  const { year, monthIndex } = parseMonth(month);
  const date = new Date(year, monthIndex + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function monthStart(month: YearMonth): IsoDate {
  return `${month}-01`;
}

export function monthEnd(month: YearMonth): IsoDate {
  const { year, monthIndex } = parseMonth(month);
  return toIsoDate(new Date(year, monthIndex + 1, 0));
}

export function addMonthsToDate(iso: IsoDate, months: number): IsoDate {
  const [y, m, d] = iso.split("-").map(Number);
  return toIsoDate(new Date(y ?? 1970, (m ?? 1) - 1 + months, d ?? 1));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatMonthLabel(
  month: YearMonth,
  style: "long" | "short" = "long",
): string {
  const { year, monthIndex } = parseMonth(month);
  const date = new Date(year, monthIndex, 1);
  const label =
    style === "long"
      ? new Intl.DateTimeFormat(LOCALE, {
          month: "long",
          year: "numeric",
        }).format(date)
      : new Intl.DateTimeFormat(LOCALE, { month: "short" })
          .format(date)
          .replace(".", "");
  return capitalize(label);
}

export function formatDate(iso: IsoDate): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

/** Numărul de zile până la o dată (negativ dacă a trecut). */
export function daysUntil(iso: IsoDate): number {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime();
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  return Math.round((target - today) / 86_400_000);
}
