import { describe, expect, it } from "vitest";
import type { Category } from "../../../types";
import {
  ImportFileError,
  buildDrafts,
  categoryBatches,
  detectColumnsByHeader,
  parseCsv,
  parseLooseDate,
  parseLooseNumber,
  toTransactionInput,
  validateDraft,
} from "./importParser";

const categories: Category[] = [
  { id: "food", name: "Alimente", type: "EXPENSE" },
  { id: "fun", name: "Divertisment", type: "EXPENSE" },
  { id: "salary", name: "Salariu", type: "INCOME" },
];
const byId = new Map(categories.map((c) => [c.id, c]));

describe("parseCsv", () => {
  it("detectează separatorul ; și tratează ghilimelele", () => {
    expect(parseCsv('Data;Descriere;Suma\r\n01.10.2026;"Cafea; ""bună""";-12,5\r\n')).toEqual([
      ["Data", "Descriere", "Suma"],
      ["01.10.2026", 'Cafea; "bună"', "-12,5"],
    ]);
  });

  it("ignoră BOM-ul și rândurile goale", () => {
    expect(parseCsv("\uFEFFa,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseLooseNumber", () => {
  it.each([
    ["1234.5", 1234.5],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["12,5 RON", 12.5],
    ["-12,50", -12.5],
    ["(100)", -100],
    ["1.234", 1234],
    ["1.234.567", 1234567],
  ])("%s -> %s", (input, expected) => {
    expect(parseLooseNumber(input)).toBe(expected);
  });

  it("întoarce null pentru text fără cifre", () => {
    expect(parseLooseNumber("abc")).toBeNull();
    expect(parseLooseNumber("")).toBeNull();
  });
});

describe("parseLooseDate", () => {
  it("acceptă formate uzuale și obiecte Date", () => {
    expect(parseLooseDate("2026-10-03")).toBe("2026-10-03");
    expect(parseLooseDate("03.10.2026")).toBe("2026-10-03");
    expect(parseLooseDate("3/10/2026")).toBe("2026-10-03");
    expect(parseLooseDate(new Date(Date.UTC(2026, 9, 3)))).toBe("2026-10-03");
    expect(parseLooseDate(46298)).toBe("2026-10-03");
  });

  it("respinge date imposibile", () => {
    expect(parseLooseDate("31.02.2026")).toBe("");
    expect(parseLooseDate("ieri")).toBe("");
  });
});

describe("buildDrafts", () => {
  it("mapează coloanele, sumele negative la cheltuieli și categoriile după nume", () => {
    const drafts = buildDrafts(
      [
        ["Data", "Descriere", "Suma", "Categorie"],
        ["01.10.2026", "Salariu octombrie", "5000", "salariu"],
        ["02.10.2026", "Mega Image", "-87,5", "ALIMENTE"],
        ["03.10.2026", "Necunoscut", "-10", "Altceva"],
      ],
      categories,
    );
    expect(drafts).toMatchObject([
      { type: "INCOME", amount: "5000", categoryId: "salary", sourceRow: 2 },
      {
        type: "EXPENSE",
        amount: "87.5",
        categoryId: "food",
        transactionDate: "2026-10-02",
      },
      { type: "EXPENSE", amount: "10", categoryId: "" },
    ]);
  });

  it("tratează sumele pozitive ca cheltuieli când nu există sume negative", () => {
    const [draft] = buildDrafts(
      [
        ["Date", "Description", "Amount"],
        ["2026-10-03", "Cinema", "40"],
      ],
      categories,
    );
    expect(draft?.type).toBe("EXPENSE");
  });

  it("ignoră rândurile cu prea multe date lipsă, dar păstrează cele incomplete", () => {
    const drafts = buildDrafts(
      [
        ["Date", "Description", "Amount"],
        ["2026-10-03", "Cinema", "40"],
        ["", "Fără dată", "15"],
        ["", "Total", ""],
        ["", "", ""],
      ],
      categories,
    );
    expect(drafts.map((d) => d.description)).toEqual(["Cinema", "Fără dată"]);
  });

  it("folosește coloana Tip și coloanele Debit/Credit", () => {
    const drafts = buildDrafts(
      [
        ["Data", "Detalii", "Debit", "Credit", "Tip"],
        ["01.10.2026", "Chirie", "1000", "", ""],
        ["02.10.2026", "Bonus", "", "300", ""],
        ["03.10.2026", "Altceva", "5", "", "Venit"],
      ],
      categories,
    );
    expect(drafts.map((d) => [d.type, d.amount])).toEqual([
      ["EXPENSE", "1000"],
      ["INCOME", "300"],
      ["INCOME", "5"],
    ]);
  });

  it("raportează coloanele lipsă și fișierele goale", () => {
    expect(() =>
      buildDrafts([["Foo", "Bar"], ["1", "2"]], categories),
    ).toThrow(/Data, Descriere, Suma/);
    expect(() => buildDrafts([], categories)).toThrow(ImportFileError);
    expect(() =>
      buildDrafts([["Data", "Descriere", "Suma"]], categories),
    ).toThrow(/nicio tranzacție/);
  });

  it("folosește maparea dată (antet pe alt rând, lună/zi)", () => {
    const drafts = buildDrafts(
      [
        ["Extras de cont"],
        ["Ref", "Booking", "Detalii", "Valoare"],
        ["1", "03/04/2026", "Kaufland", "-10"],
      ],
      categories,
      {
        headerRow: 2,
        date: 1,
        description: 2,
        amount: 3,
        dateFormat: "MDY",
      },
    );
    expect(drafts).toMatchObject([
      { sourceRow: 3, transactionDate: "2026-03-04", description: "Kaufland" },
    ]);
  });
});

describe("detectColumnsByHeader", () => {
  it("găsește antetul și dacă nu e pe prima linie", () => {
    expect(
      detectColumnsByHeader([
        ["Banca X"],
        ["Date", "Details", "Debit", "Credit"],
        ["2026-01-01", "x", "5", ""],
      ]),
    ).toMatchObject({ headerRow: 2, date: 0, description: 1, debit: 2, credit: 3 });
  });

  it("recunoaște extrasul cu Comerciant și Valoarea tranzacției (prima sumă din două)", () => {
    const rows = [
      [],
      ["Tranzacții"],
      [],
      [
        "Data tranzacției",
        "RRN",
        "Statusul tranzactiei",
        "Comerciant",
        "Valoarea tranzactiei în moneda contului",
        "Valoarea tranzactiei",
      ],
      ["20-10-2026 13:50:13", "1", "Decontat", "OMV 1923, CLUJ", "20,5", "20,5"],
    ];
    const mapping = detectColumnsByHeader(rows);
    expect(mapping).toMatchObject({ headerRow: 4, date: 0, description: 3, amount: 4 });
    expect(buildDrafts(rows, [], mapping)[0]).toMatchObject({
      amount: "20.5",
      transactionDate: "2026-10-20",
      description: "OMV 1923, CLUJ",
      type: "EXPENSE",
    });
  });

  it("întoarce null când nu există antet recognoscibil", () => {
    expect(detectColumnsByHeader([["a", "b"], ["1", "2"]])).toBeNull();
  });
});

describe("categoryBatches", () => {
  it("grupează aceeași descriere (fără diacritice/majuscule) și ignoră rândurile cu categorie", () => {
    const base = {
      sourceRow: 2,
      amount: "1",
      transactionDate: "2030-01-01",
      type: "EXPENSE" as const,
    };
    const batches = categoryBatches([
      { ...base, key: "a", description: "Cafea Șef", categoryId: "" },
      { ...base, key: "b", description: "cafea sef", categoryId: "" },
      { ...base, key: "c", description: "Altceva", categoryId: "food" },
    ]);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.items).toHaveLength(1);
    expect(batches[0]?.keysByIndex.get(0)).toEqual(["a", "b"]);
  });
});

describe("validateDraft", () => {
  const valid = {
    key: "row-2",
    sourceRow: 2,
    type: "EXPENSE" as const,
    amount: "12.5",
    description: "Cafea",
    transactionDate: "2026-10-03",
    categoryId: "food",
  };

  it("acceptă un rând valid și îl convertește pentru API", () => {
    expect(validateDraft(valid, byId)).toEqual({});
    expect(toTransactionInput(valid)).toEqual({
      type: "EXPENSE",
      amount: 12.5,
      description: "Cafea",
      transactionDate: "2026-10-03",
      categoryId: "food",
    });
  });

  it("marchează câmpurile invalide", () => {
    const errors = validateDraft(
      {
        ...valid,
        amount: "0",
        description: " ",
        transactionDate: "",
        categoryId: "salary",
      },
      byId,
    );
    expect(Object.keys(errors).sort()).toEqual([
      "amount",
      "categoryId",
      "description",
      "transactionDate",
    ]);
  });
});
