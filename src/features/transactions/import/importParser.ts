import type {
  Category,
  ImportCategoryItem,
  ImportColumnMapping,
  ImportExistingItem,
  IsoDate,
  TransactionInput,
  TransactionType,
} from "../../../types";
import { amountField, parseAmount } from "../../../utils/validation";

export type Cell = string | number | boolean | Date | null | undefined;
type DateFormat = NonNullable<ImportColumnMapping["dateFormat"]>;

export const MAX_IMPORT_ROWS = 1000;
const SAMPLE_ROWS = 15;
/** Sub limita de 60 de tranzacții acceptată de backend pentru o singură cerere AI. */
const CATEGORY_BATCH = 40;
export const DESCRIPTION_MAX = 120;
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_FILE_ACCEPT =
  ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export class ImportFileError extends Error {}

/** Un rând propus spre import; valorile se pot corecta în previzualizare. */
export interface ImportDraft {
  key: string;
  /** Numărul rândului din fișier (1 = antetul). */
  sourceRow: number;
  type: TransactionType;
  amount: string;
  description: string;
  transactionDate: string;
  categoryId: string;
  /**
   * De unde vine categoria: `remembered` din alegerile anterioare ale utilizatorului, `suggested` de la AI;
   * `unsure`: nici memoria, nici AI-ul nu au știut, o alege utilizatorul.
   */
  aiState?: "remembered" | "suggested" | "unsure";
  /** Categoria propusă (din memorie sau de AI), ca să se știe la salvare dacă utilizatorul a corectat-o. */
  suggestedCategoryId?: string;
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Același tip și aceeași descriere (fără diacritice, majuscule, punctuație): aceeași categorie. */
export function sameDescriptionKey(draft: Pick<ImportDraft, "type" | "description">) {
  return `${draft.type}|${normalize(draft.description.trim())}`;
}

const HEADERS = {
  date: [
    "data",
    "date",
    "transactiondate",
    "data tranzactiei",
    "data operarii",
    "data procesarii",
  ],
  description: [
    "descriere",
    "description",
    "detalii",
    "detalii tranzactie",
    "details",
    "beneficiar",
    "comerciant",
    "merchant",
    "nume",
    "memo",
  ],
  amount: [
    "suma",
    "amount",
    "valoare",
    "value",
    "total",
    "suma tranzactiei",
    "valoarea tranzactiei",
    "valoarea tranzactiei in moneda contului",
  ],
  debit: ["debit", "retras", "plati", "cheltuieli"],
  credit: ["credit", "depus", "incasari", "venituri"],
  type: ["tip", "type", "tip tranzactie"],
  category: ["categorie", "category"],
} as const;

type Field = keyof typeof HEADERS;

const INCOME_WORDS = new Set([
  "venit",
  "income",
  "credit",
  "intrare",
  "incasare",
  "c",
  "cr",
]);
const EXPENSE_WORDS = new Set([
  "cheltuiala",
  "expense",
  "debit",
  "iesire",
  "plata",
  "d",
  "db",
  "dr",
]);

/** Parsează text CSV (ghilimele, `""`, CRLF) cu separatorul detectat automat: `,` `;` sau tab. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", "\t", ","]
    .map((d) => ({ d, count: countOutsideQuotes(firstLine, d) }))
    .reduce((best, c) => (c.count > best.count ? c : best), {
      d: ",",
      count: 0,
    }).d;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endRow = () => {
    row.push(field);
    field = "";
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (quoted) {
      if (ch === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text.charAt(i + 1) === "\n") i++;
      endRow();
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

function countOutsideQuotes(line: string, delimiter: string): number {
  let quoted = false;
  let count = 0;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === delimiter && !quoted) count++;
  }
  return count;
}

/** Citește un fișier `.csv` sau `.xlsx` (prima foaie) ca matrice de celule. */
export async function readImportFile(file: File): Promise<Cell[][]> {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new ImportFileError("Fișierul este prea mare (maxim 5 MB).");
  }
  const name = file.name.toLowerCase();
  const isCsv = name.endsWith(".csv") || name.endsWith(".txt");
  const isXlsx = name.endsWith(".xlsx");
  if (!isCsv && !isXlsx) {
    throw new ImportFileError(
      name.endsWith(".xls")
        ? "Formatul .xls nu este suportat. Salvează fișierul ca .xlsx sau .csv."
        : "Format necunoscut. Încarcă un fișier .csv sau .xlsx.",
    );
  }
  try {
    if (isCsv) return parseCsv(await file.text());
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as Cell[][];
  } catch {
    throw new ImportFileError(
      "Fișierul nu a putut fi citit. Verifică dacă este un CSV sau Excel (.xlsx) valid.",
    );
  }
}

const cellText = (cell: Cell): string =>
  cell === null || cell === undefined
    ? ""
    : cell instanceof Date
      ? cell.toISOString()
      : String(cell).trim();

/** Acceptă `1234.5`, `1.234,56`, `1,234.56`, `-12,5 RON`, `(100)`; întoarce `null` dacă nu e număr. */
export function parseLooseNumber(cell: Cell): number | null {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  let text = cellText(cell);
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/[^\d.,+-]/g, "");
  if (/^-/.test(text) || /-$/.test(text)) negative = true;
  text = text.replace(/[+-]/g, "");
  if (!/\d/.test(text)) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let decimalSeparator: "," | "." | null = null;
  if (lastComma >= 0 && lastDot >= 0) {
    decimalSeparator = lastComma > lastDot ? "," : ".";
  } else {
    const sep = lastComma >= 0 ? "," : lastDot >= 0 ? "." : null;
    if (sep) {
      const occurrences = text.split(sep).length - 1;
      const digitsAfter = text.length - text.lastIndexOf(sep) - 1;
      // "1.234" sau "1.234.567" sunt mii; o singură apariție cu alt număr de cifre după e zecimală.
      if (occurrences === 1 && digitsAfter !== 3) decimalSeparator = sep;
    }
  }
  const normalized =
    decimalSeparator === null
      ? text.replace(/[.,]/g, "")
      : text
          .split(decimalSeparator === "," ? "." : ",")
          .join("")
          .replace(decimalSeparator, ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

const pad = (n: number) => String(n).padStart(2, "0");

function isRealDate(y: number, m: number, d: number): boolean {
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    y >= 1900 &&
    y <= 2200 &&
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/** Acceptă `2026-10-03`, `03.10.2026` (zi/lună, sau lună/zi cu `MDY`), `Date` și serialul Excel; altfel `""`. */
export function parseLooseDate(
  cell: Cell,
  format: DateFormat = "DMY",
): IsoDate | "" {
  if (cell instanceof Date) {
    return Number.isNaN(cell.getTime())
      ? ""
      : `${cell.getUTCFullYear()}-${pad(cell.getUTCMonth() + 1)}-${pad(cell.getUTCDate())}`;
  }
  if (typeof cell === "number") {
    if (cell < 20_000 || cell > 80_000) return "";
    return parseLooseDate(new Date(Math.round((cell - 25_569) * 86_400_000)));
  }
  const text = cellText(cell);
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(text);
  if (match) {
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    return isRealDate(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : "";
  }
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[T\s].*)?$/.exec(text);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const [d, m] = format === "MDY" ? [second, first] : [first, second];
    const y = Number(match[3]);
    return isRealDate(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : "";
  }
  return "";
}

export function parseTypeWord(cell: Cell): TransactionType | null {
  const word = normalize(cellText(cell));
  if (INCOME_WORDS.has(word)) return "INCOME";
  if (EXPENSE_WORDS.has(word)) return "EXPENSE";
  return null;
}

const FIELDS: Field[] = [
  "date",
  "description",
  "amount",
  "debit",
  "credit",
  "type",
  "category",
];

/** Recunoaște coloanele după titluri (Data, Descriere, Suma...); folosit când AI-ul nu e disponibil. */
export function detectColumnsByHeader(
  rows: Cell[][],
): ImportColumnMapping | null {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const found: Partial<Record<Field, number>> = {};
    (rows[i] ?? []).forEach((cell, index) => {
      const name = normalize(cellText(cell));
      for (const field of FIELDS) {
        if (
          found[field] === undefined &&
          (HEADERS[field] as readonly string[]).includes(name)
        ) {
          found[field] = index;
          break;
        }
      }
    });
    const hasAmount =
      found.amount !== undefined ||
      found.debit !== undefined ||
      found.credit !== undefined;
    if (found.date !== undefined && found.description !== undefined && hasAmount) {
      return { headerRow: i + 1, dateFormat: "DMY", ...found };
    }
  }
  return null;
}

const squeeze = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Păstrează din descriere doar textul de dinaintea primei apariții a separatorului (ales de AI sau dedus)
 * și curăță spațiile multiple.
 */
export function cutDescription(text: string, cutAt?: string | null): string {
  const clean = squeeze(text);
  if (!cutAt) return clean;
  const index = clean.indexOf(cutAt.trim() || cutAt);
  const kept = index > 0 ? clean.slice(0, index).trim() : clean;
  return kept || clean;
}

/**
 * Extrasele bancare scriu des „COMERCIANT, ORAȘ, JUDEȚ". Dacă AI-ul nu a indicat separatorul, dar aproape
 * toate descrierile au virgulă după un nume, tăiem la prima virgulă ca să rămână doar comerciantul.
 */
export function inferDescriptionCut(
  rows: Cell[][],
  mapping: ImportColumnMapping,
): string | null {
  const column = mapping.description;
  if (column == null) return null;
  const texts = rows
    .slice(Math.max(0, mapping.headerRow))
    .map((row) => cellText(row[column]))
    .filter((text) => text !== "")
    .slice(0, 50);
  if (texts.length < 3) return null;
  const withComma = texts.filter((text) => text.indexOf(",") > 2).length;
  return withComma * 10 >= texts.length * 7 ? "," : null;
}

/**
 * Verifică maparea AI-ului pe datele din fișier (data se citește, suma e număr, descrierea e text).
 * Dacă rândul de antet e greșit, îl corectează: datele încep la primul rând cu dată validă.
 * Întoarce `null` când maparea nu se potrivește cu conținutul.
 */
export function checkMapping(
  rows: Cell[][],
  mapping: ImportColumnMapping,
): ImportColumnMapping | null {
  const { date, description } = mapping;
  if (date == null || description == null) return null;
  const amountColumns = [mapping.amount, mapping.debit, mapping.credit].filter(
    (c): c is number => c != null,
  );
  if (amountColumns.length === 0) return null;
  const format = mapping.dateFormat ?? "DMY";
  const hasDate = (row: Cell[]) => parseLooseDate(row[date], format) !== "";
  const isBlank = (row: Cell[]) => row.every((c) => cellText(c) === "");

  let start = Math.max(0, mapping.headerRow);
  while (start < rows.length && isBlank(rows[start] ?? [])) start++;
  if (start >= rows.length) return null;
  if (!hasDate(rows[start] ?? [])) {
    start = rows.findIndex((row, i) => i < 50 && hasDate(row));
    if (start < 0) return null;
  }

  const sample = rows
    .slice(start)
    .filter((row) => !isBlank(row))
    .slice(0, 20);
  const mostly = (test: (row: Cell[]) => boolean) =>
    sample.filter(test).length * 2 >= sample.length;
  const textual = (row: Cell[]) => /\p{L}/u.test(cellText(row[description]));
  const numeric = (row: Cell[]) =>
    amountColumns.some((c) => parseLooseNumber(row[c]) !== null);
  if (!mostly(hasDate) || !mostly(textual) || !mostly(numeric)) return null;
  // O coloană cu aceeași valoare pe aproape toate rândurile (ex. „Decontat") e un status, nu comerciantul.
  const distinct = new Set(sample.map((row) => normalize(cellText(row[description])))).size;
  if (sample.length >= 8 ? distinct <= 2 : sample.length >= 4 && distinct <= 1) {
    return null;
  }
  return { ...mapping, headerRow: start };
}

export function formatAmountInput(value: number): string {
  return (Math.round(Math.abs(value) * 100) / 100).toString();
}

const MISSING_COLUMNS_MESSAGE =
  "Nu am găsit coloanele obligatorii: Data, Descriere, Suma. Prima linie trebuie să fie antetul (ex.: Data, Descriere, Suma, Tip, Categorie).";

/**
 * Transformă rândurile fișierului în propuneri de tranzacții, după maparea coloanelor
 * (de la AI sau, în lipsa ei, recunoscută după titluri). Categoria se completează aici doar
 * dacă fișierul are o coloană cu numele unei categorii existente.
 */
export function buildDrafts(
  rows: Cell[][],
  categories: Category[],
  mapping: ImportColumnMapping | null = detectColumnsByHeader(rows),
): ImportDraft[] {
  if (!rows.some((r) => r.some((c) => cellText(c) !== ""))) {
    throw new ImportFileError("Fișierul este gol.");
  }
  if (
    !mapping ||
    mapping.date == null ||
    mapping.description == null ||
    (mapping.amount == null && mapping.debit == null && mapping.credit == null)
  ) {
    throw new ImportFileError(MISSING_COLUMNS_MESSAGE);
  }

  const dataRows = rows
    .map((cells, i) => ({ cells, sourceRow: i + 1 }))
    .slice(Math.max(0, mapping.headerRow))
    .filter(({ cells }) => cells.some((c) => cellText(c) !== ""));
  if (dataRows.length === 0) {
    throw new ImportFileError("Fișierul nu conține nicio tranzacție.");
  }
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new ImportFileError(
      `Fișierul are ${dataRows.length} rânduri; poți importa cel mult ${MAX_IMPORT_ROWS} odată.`,
    );
  }

  const cell = (cells: Cell[], field: Field) => {
    const index = mapping[field];
    return index == null ? undefined : cells[index];
  };
  const cutAt = mapping.descriptionCutAt || inferDescriptionCut(rows, mapping);

  // Fără coloană de tip, semnul sumei decide; dacă nu există sume negative, totul e cheltuială.
  const hasNegative = dataRows.some(({ cells }) => {
    const n = parseLooseNumber(cell(cells, "amount"));
    return n !== null && n < 0;
  });

  const drafts = dataRows.map(({ cells, sourceRow }) => {
    let signed = parseLooseNumber(cell(cells, "amount"));
    let explicitType = parseTypeWord(cell(cells, "type"));
    if (signed === null) {
      const credit = parseLooseNumber(cell(cells, "credit"));
      const debit = parseLooseNumber(cell(cells, "debit"));
      if (credit !== null && credit !== 0) {
        signed = Math.abs(credit);
        explicitType ??= "INCOME";
      } else if (debit !== null && debit !== 0) {
        signed = Math.abs(debit);
        explicitType ??= "EXPENSE";
      }
    }

    const categoryName = normalize(cellText(cell(cells, "category")));
    const named = categoryName
      ? categories.filter((c) => normalize(c.name) === categoryName)
      : [];

    let type: TransactionType =
      explicitType ??
      (signed !== null && signed < 0
        ? "EXPENSE"
        : hasNegative
          ? "INCOME"
          : "EXPENSE");
    const category =
      named.find((c) => c.type === type) ??
      (explicitType === null && named.length === 1 ? named[0] : undefined);
    if (category) type = category.type;

    return {
      key: `row-${sourceRow}`,
      sourceRow,
      type,
      amount: signed === null ? "" : formatAmountInput(signed),
      description: cutDescription(
        cellText(cell(cells, "description")),
        cutAt,
      ).slice(0, DESCRIPTION_MAX),
      transactionDate: parseLooseDate(
        cell(cells, "date"),
        mapping.dateFormat ?? "DMY",
      ),
      categoryId: category?.id ?? "",
    };
  });

  // Rândurile cu cel puțin două dintre data, descrierea și suma lipsă (totaluri, note de subsol) se ignoră.
  const complete = drafts.filter(
    (d) =>
      [d.transactionDate, d.description.trim(), d.amount].filter(Boolean)
        .length >= 2,
  );
  if (complete.length === 0) {
    throw new ImportFileError("Fișierul nu conține nicio tranzacție.");
  }
  return complete;
}

/** Primele rânduri ale fișierului, ca text, pentru recunoașterea coloanelor de către AI. */
export function sampleRowsForAi(rows: Cell[][]): string[][] {
  return rows
    .slice(0, SAMPLE_ROWS)
    .map((row) => row.slice(0, 40).map((c) => cellText(c).slice(0, 80)));
}

/** Descrieri unice (pe tip) fără categorie, grupate în loturi pentru AI. */
export function categoryBatches(
  drafts: ImportDraft[],
  batchSize = CATEGORY_BATCH,
): { items: ImportCategoryItem[]; keysByIndex: Map<number, string[]> }[] {
  const unique = new Map<string, { item: ImportCategoryItem; keys: string[] }>();
  for (const draft of drafts) {
    const description = draft.description.trim();
    if (draft.categoryId || !description) continue;
    const id = sameDescriptionKey(draft);
    const entry = unique.get(id);
    if (entry) entry.keys.push(draft.key);
    else {
      unique.set(id, {
        item: { index: unique.size, description, type: draft.type },
        keys: [draft.key],
      });
    }
  }
  const entries = [...unique.values()];
  const batches: ReturnType<typeof categoryBatches> = [];
  for (let i = 0; i < entries.length; i += batchSize) {
    const slice = entries.slice(i, i + batchSize);
    batches.push({
      items: slice.map((e) => e.item),
      keysByIndex: new Map(slice.map((e) => [e.item.index, e.keys])),
    });
  }
  return batches;
}

export interface DraftErrors {
  transactionDate?: string;
  description?: string;
  amount?: string;
  categoryId?: string;
}

/** Aceleași reguli ca formularul de tranzacție; întoarce un obiect gol dacă rândul e valid. */
export function validateDraft(
  draft: ImportDraft,
  categoriesById: Map<string, Category>,
): DraftErrors {
  const errors: DraftErrors = {};
  if (!isRealIso(draft.transactionDate)) {
    errors.transactionDate = "Dată invalidă";
  }
  const description = draft.description.trim();
  if (!description) errors.description = "Descriere obligatorie";
  else if (description.length > DESCRIPTION_MAX) {
    errors.description = `Maxim ${DESCRIPTION_MAX} de caractere`;
  }
  const amount = amountField.safeParse(draft.amount);
  if (!amount.success) {
    errors.amount = amount.error.issues[0]?.message ?? "Sumă invalidă";
  }
  const category = categoriesById.get(draft.categoryId);
  if (!category) errors.categoryId = "Alege categoria";
  else if (category.type !== draft.type) {
    errors.categoryId = "Categoria nu se potrivește cu tipul";
  }
  return errors;
}

function isRealIso(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return !!match && isRealDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function toTransactionInput(draft: ImportDraft): TransactionInput {
  return {
    type: draft.type,
    amount: parseAmount(draft.amount),
    description: draft.description.trim(),
    transactionDate: draft.transactionDate,
    categoryId: draft.categoryId,
  };
}

/**
 * Rândurile cu dată, sumă și descriere valide, de verificat dacă există deja în aplicație;
 * `index` e poziția rândului în `drafts`.
 */
export function existingCheckItems(drafts: ImportDraft[]): ImportExistingItem[] {
  return drafts.flatMap((draft, index) => {
    const description = draft.description.trim();
    if (
      !description ||
      description.length > DESCRIPTION_MAX ||
      !isRealIso(draft.transactionDate) ||
      !amountField.safeParse(draft.amount).success
    ) {
      return [];
    }
    return [
      {
        index,
        type: draft.type,
        amount: parseAmount(draft.amount),
        description,
        transactionDate: draft.transactionDate,
      },
    ];
  });
}
