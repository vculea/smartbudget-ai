import { z } from "zod";

/** Acceptă `1234`, `1234.5`, `1234,56` (maxim 2 zecimale). */
export function parseAmount(value: string): number {
  return Number(value.trim().replace(",", "."));
}

export const MAX_AMOUNT = 999_999_999;

export const amountField = z
  .string()
  .trim()
  .min(1, "Introdu suma")
  .regex(/^\d+([.,]\d{1,2})?$/, "Introdu o sumă validă (maxim 2 zecimale)")
  .refine((v) => parseAmount(v) > 0, "Suma trebuie să fie mai mare decât 0")
  .refine((v) => parseAmount(v) <= MAX_AMOUNT, "Suma introdusă este prea mare");

export const isoDateField = (message = "Selectează o dată validă") =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message);

export const requiredText = (label: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `${label} este obligatoriu`)
    .max(max, `${label} poate avea cel mult ${max} de caractere`);
