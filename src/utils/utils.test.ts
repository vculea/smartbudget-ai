import { describe, expect, it } from "vitest";
import { clampPercent, formatCurrency, formatPercent } from "./format";
import { getBudgetLevel } from "./budget";
import { amountField, parseAmount } from "./validation";
import { shiftMonth } from "./date";

describe("formatare", () => {
  it("formatează sumele în RON cu localizarea ro-RO", () => {
    const text = formatCurrency(1234.5).replace(/\s/g, " ");
    expect(text).toContain("1.234,50");
    expect(text).toContain("RON");
  });

  it("formatează procentele", () => {
    expect(formatPercent(12.34, 1)).toBe("12,3%");
  });

  it("limitează procentele între 0 și 100", () => {
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(-5)).toBe(0);
  });
});

describe("nivel buget", () => {
  it.each([
    [0, "ok"],
    [79.9, "ok"],
    [80, "warning"],
    [100, "warning"],
    [100.1, "exceeded"],
  ])("%s%% => %s", (value, expected) => {
    expect(getBudgetLevel(value)).toBe(expected);
  });
});

describe("validare sume", () => {
  it("acceptă virgulă și punct", () => {
    expect(parseAmount("12,50")).toBe(12.5);
    expect(amountField.safeParse("12.5").success).toBe(true);
    expect(amountField.safeParse("1234,56").success).toBe(true);
  });

  it.each(["", "abc", "-5", "0", "1.234", "12,345"])(
    'respinge "%s"',
    (value) => {
      expect(amountField.safeParse(value).success).toBe(false);
    },
  );
});

describe("luni", () => {
  it("schimbă luna peste limita anului", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});
