import { describe, expect, it, vi } from "vitest";
import type { TransactionImportAiApi } from "../../../api/contracts";
import { ApiError } from "../../../api/errors";
import type { Category } from "../../../types";
import { ImportFileError, type ImportDraft } from "./importParser";
import { loadImport, suggestMissingCategories } from "./importWorkflow";

const categories: Category[] = [
  { id: "food", name: "Alimente", type: "EXPENSE" },
  { id: "salary", name: "Salariu", type: "INCOME" },
];

const csvFile = (content: string) =>
  new File([content], "extras.csv", { type: "text/csv" });

const fakeAi = (
  overrides: Partial<TransactionImportAiApi> = {},
): TransactionImportAiApi => ({
  detectColumns: vi.fn().mockRejectedValue(new ApiError("AI oprit.", 503)),
  suggestCategories: vi.fn().mockResolvedValue([]),
  ...overrides,
});

describe("loadImport", () => {
  it("folosește coloanele recunoscute de AI chiar și fără antet cunoscut", async () => {
    const ai = fakeAi({
      detectColumns: vi.fn().mockResolvedValue({
        headerRow: 1,
        date: 1,
        description: 3,
        amount: 5,
        dateFormat: "MDY",
      }),
    });

    const loaded = await loadImport(
      csvFile(
        "Nr;Booking;Ref;Detalii plata;Cont;Valoare RON\n1;03/04/2026;x;MEGA IMAGE;y;-45,10",
      ),
      categories,
      ai,
    );

    expect(loaded.mappingSource).toBe("ai");
    expect(loaded.drafts).toMatchObject([
      {
        transactionDate: "2026-03-04",
        description: "MEGA IMAGE",
        amount: "45.1",
        type: "EXPENSE",
      },
    ]);
  });

  it("taie descrierea la separatorul dat de AI și corectează rândul de antet", async () => {
    const ai = fakeAi({
      detectColumns: vi.fn().mockResolvedValue({
        headerRow: 1,
        date: 0,
        description: 3,
        amount: 4,
        descriptionCutAt: ",",
      }),
    });
    const loaded = await loadImport(
      csvFile(
        [
          "Tranzacții;;;;;",
          ";;;;;",
          "Data tranzacției;RRN;Status;Comerciant;Valoare cont;Valoare",
          "20-10-2026 13:50:13;1;Decontat;OMV 1923, CLUJ, CLUJ;20,5;20,5",
        ].join("\n"),
      ),
      categories,
      ai,
    );
    expect(loaded.mappingSource).toBe("ai");
    expect(loaded.drafts).toHaveLength(1);
    expect(loaded.drafts[0]).toMatchObject({
      description: "OMV 1923",
      amount: "20.5",
      transactionDate: "2026-10-20",
    });
  });

  it("ignoră maparea AI care pune suma la descriere și folosește titlurile", async () => {
    const ai = fakeAi({
      detectColumns: vi.fn().mockResolvedValue({
        headerRow: 1,
        date: 0,
        description: 5,
        amount: 4,
      }),
    });
    const loaded = await loadImport(
      csvFile(
        [
          "Data tranzacției;RRN;Status;Comerciant;Valoarea tranzactiei in moneda contului;Valoarea tranzactiei",
          "20-10-2026 13:50:13;1;Decontat;OMV 1923, CLUJ;20,5;20,5",
        ].join("\n"),
      ),
      categories,
      ai,
    );
    expect(loaded.mappingSource).toBe("header");
    expect(loaded.drafts[0]).toMatchObject({ description: "OMV 1923, CLUJ" });
  });

  it("trimite AI-ului primele rânduri ca text", async () => {
    const detectColumns = vi.fn().mockResolvedValue({
      headerRow: 1,
      date: 0,
      description: 1,
      amount: 2,
    });
    await loadImport(
      csvFile("Data;Descriere;Suma\n01.01.2030;Cafea;-5"),
      categories,
      fakeAi({ detectColumns }),
    );
    expect(detectColumns).toHaveBeenCalledWith([
      ["Data", "Descriere", "Suma"],
      ["01.01.2030", "Cafea", "-5"],
    ]);
  });

  it("revine la titlurile coloanelor când AI-ul nu răspunde", async () => {
    const loaded = await loadImport(
      csvFile("Data;Descriere;Suma\n01.01.2030;Cafea;-5"),
      categories,
      fakeAi(),
    );
    expect(loaded.mappingSource).toBe("header");
    expect(loaded.note).toContain("AI oprit.");
    expect(loaded.drafts).toHaveLength(1);
  });

  it("dă eroare când nici AI-ul, nici titlurile nu recunosc coloanele", async () => {
    await expect(
      loadImport(csvFile("a;b\n1;2"), categories, fakeAi()),
    ).rejects.toThrow(ImportFileError);
  });
});

const draft = (key: string, description: string, categoryId = ""): ImportDraft => ({
  key,
  sourceRow: 2,
  type: "EXPENSE",
  amount: "10",
  description,
  transactionDate: "2030-01-01",
  categoryId,
});

describe("suggestMissingCategories", () => {
  it("cere o singură dată fiecare descriere unică și sare rândurile care au deja categorie", async () => {
    const suggestCategories = vi.fn().mockResolvedValue([
      { index: 0, categoryId: "food" },
      { index: 1, categoryId: null },
    ]);
    const updates = new Map<string, { categoryId: string | null }>();

    const failure = await suggestMissingCategories(
      [
        draft("a", "MEGA IMAGE"),
        draft("b", "mega image"),
        draft("c", "Necunoscut"),
        draft("d", "Deja setat", "food"),
      ],
      (batch) => batch.forEach((value, key) => updates.set(key, value)),
      () => false,
      fakeAi({ suggestCategories }),
    );

    expect(failure).toBeNull();
    expect(suggestCategories).toHaveBeenCalledTimes(1);
    expect(suggestCategories.mock.calls[0]?.[0]).toHaveLength(2);
    expect(Object.fromEntries(updates)).toEqual({
      a: { categoryId: "food" },
      b: { categoryId: "food" },
      c: { categoryId: null },
    });
  });

  it("trimite loturi de cel mult 40 de descrieri", async () => {
    const suggestCategories = vi.fn().mockResolvedValue([]);
    const many = Array.from({ length: 95 }, (_, i) => draft(`k${i}`, `Magazin ${i}`));

    await suggestMissingCategories(many, () => {}, () => false, fakeAi({ suggestCategories }));

    expect(suggestCategories.mock.calls.map((c) => c[0].length)).toEqual([40, 40, 15]);
  });

  it("întoarce mesajul erorii și lasă categoriile goale când AI-ul eșuează", async () => {
    const onProgress = vi.fn();
    const failure = await suggestMissingCategories(
      [draft("a", "MEGA IMAGE")],
      onProgress,
      () => false,
      fakeAi({
        suggestCategories: vi.fn().mockRejectedValue(new ApiError("Prea multe cereri.", 429)),
      }),
    );
    expect(failure).toBe("Prea multe cereri.");
    expect(onProgress).not.toHaveBeenCalled();
  });
});
