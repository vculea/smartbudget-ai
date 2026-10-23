import { describe, expect, it } from "vitest";
import { loadDb } from "./db";
import {
  learnMemory,
  matchMemory,
  merchantKey,
  moveMemoryCategory,
} from "./categoryMemory";
import { CATEGORY } from "./seed";

describe("memoria categoriilor (demo)", () => {
  it("folosește aceleași chei de comerciant ca backendul", () => {
    expect(merchantKey("KAUFLAND 1234 CLUJ-NAPOCA SRL")).toBe("kaufland cluj napoca");
    expect(merchantKey("Plata la POS MEGA IMAGE 0123 TID:998877")).toBe("mega image");
    expect(merchantKey("POS 123456 RON 45,10")).toBe("");
  });

  it("recunoaște alte magazine ale aceluiași comerciant și respectă ultima corectură", () => {
    const db = loadDb();
    learnMemory(db, [
      { description: "KAUFLAND 12 CLUJ", type: "EXPENSE", categoryId: CATEGORY.groceries, corrected: false },
      { description: "GLOVO 1", type: "EXPENSE", categoryId: CATEGORY.groceries, corrected: false },
      { description: "GLOVO 2", type: "EXPENSE", categoryId: CATEGORY.restaurants, corrected: true },
    ]);

    expect(
      matchMemory(db, [
        { index: 0, description: "Kaufland Brasov", type: "EXPENSE" },
        { index: 1, description: "GLOVO 99", type: "EXPENSE" },
        { index: 2, description: "Kaufland", type: "INCOME" },
      ]).map((s) => s.categoryId),
    ).toEqual([CATEGORY.groceries, CATEGORY.restaurants, null]);
  });

  it("mută alegerile când categoria e ștearsă", () => {
    const db = loadDb();
    learnMemory(db, [
      { description: "Netflix", type: "EXPENSE", categoryId: CATEGORY.subscriptions, corrected: false },
    ]);
    moveMemoryCategory(CATEGORY.subscriptions, CATEGORY.entertainment);

    expect(
      matchMemory(db, [{ index: 0, description: "NETFLIX.COM", type: "EXPENSE" }])[0]
        ?.categoryId,
    ).toBe(CATEGORY.entertainment);
  });
});
