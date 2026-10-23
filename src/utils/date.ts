import type { IsoDate, Period, YearMonth } from "../types";

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

/** Perioadele de tip an sunt `YYYY`; lunile sunt `YYYY-MM`. */
export function isYearPeriod(period: Period): boolean {
  return /^\d{4}$/.test(period);
}

export function yearOf(period: Period): number {
  return Number(period.slice(0, 4));
}

export function shiftPeriod(period: Period, delta: number): Period {
  return isYearPeriod(period)
    ? String(Number(period) + delta)
    : shiftMonth(period, delta);
}

export function formatPeriodLabel(period: Period): string {
  return isYearPeriod(period) ? `Anul ${period}` : formatMonthLabel(period);
}

/** Parametrii de interogare / corp acceptați de backend pentru o perioadă. */
export function periodParams(
  period: Period,
): { month: YearMonth } | { year: number } {
  return isYearPeriod(period) ? { year: Number(period) } : { month: period };
}

/** Formatează o dată ca `DD-Lun-YYYY` (ex. `20-Oct-2026`), la fel ca input-ul de dată. */
export function formatDate(iso: IsoDate): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const month = capitalize(
    new Intl.DateTimeFormat(LOCALE, { month: "short" })
      .format(date)
      .replace(".", ""),
  );
  return `${pad(date.getDate())}-${month}-${date.getFullYear()}`;
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
