import {
  categoryMemoryApi,
  getErrorMessage,
  transactionImportAiApi,
  transactionsApi,
} from "../../../api";
import type {
  CategoryMemoryApi,
  TransactionImportAiApi,
  TransactionsApi,
} from "../../../api/contracts";
import type { Category, CategoryMemoryLesson } from "../../../types";
import {
  ImportFileError,
  buildDrafts,
  categoryBatches,
  detectColumnsByHeader,
  checkMapping,
  existingCheckItems,
  readImportFile,
  sampleRowsForAi,
  type ImportDraft,
} from "./importParser";

export interface LoadedImport {
  drafts: ImportDraft[];
  /** `ai`: coloanele le-a recunoscut AI-ul; `header`: după titlurile coloanelor. */
  mappingSource: "ai" | "header";
  /** Motivul pentru care s-a folosit varianta de rezervă. */
  note?: string;
}

/** Citește fișierul și recunoaște coloanele cu AI-ul ales în Setări AI (rezervă: titlurile coloanelor). */
export async function loadImport(
  file: File,
  categories: Category[],
  ai: TransactionImportAiApi = transactionImportAiApi,
): Promise<LoadedImport> {
  const rows = await readImportFile(file);
  let aiMapping;
  let aiFailure = "";
  try {
    aiMapping = await ai.detectColumns(sampleRowsForAi(rows));
  } catch (error) {
    aiFailure = getErrorMessage(error, "AI-ul nu este disponibil.");
  }
  if (aiMapping) {
    let checked = checkMapping(rows, aiMapping);
    // Titlul explicit al coloanei de descriere (Descriere, Comerciant...) bate alegerea AI-ului, care poate greși între rulări.
    const byHeader = detectColumnsByHeader(rows);
    if (
      checked &&
      byHeader?.description != null &&
      byHeader.description !== checked.description
    ) {
      // Separatorul ales de AI se referea la coloana greșită; se deduce din coloana corectă.
      checked =
        checkMapping(rows, {
          ...checked,
          description: byHeader.description,
          descriptionCutAt: null,
        }) ?? checked;
    }
    if (checked) {
      return {
        drafts: buildDrafts(rows, categories, checked),
        mappingSource: "ai",
      };
    }
    aiFailure = "Coloanele recunoscute de AI nu se potrivesc cu conținutul fișierului.";
  }
  const headerMapping = detectColumnsByHeader(rows);
  if (!headerMapping) {
    throw new ImportFileError(
      `Nu am putut recunoaște coloanele fișierului. ${aiFailure}`.trim(),
    );
  }
  return {
    drafts: buildDrafts(rows, categories, headerMapping),
    mappingSource: "header",
    note: `${aiFailure} Am recunoscut coloanele după titluri.`.trim(),
  };
}

export interface CategoryUpdate {
  /** `null`: AI-ul nu a fost sigur. */
  categoryId: string | null;
  /** `memory`: din alegerile anterioare ale utilizatorului; `ai`: propusă de AI. */
  source: "memory" | "ai";
}

/** Cât încape într-o cerere către memoria categoriilor (cât un import întreg). */
const MEMORY_BATCH = 1000;

/**
 * Categoriile reținute din alegerile anterioare ale utilizatorului, pentru rândurile fără categorie.
 * Dacă memoria nu răspunde, întoarce ce a găsit până atunci: restul rândurilor ajung la AI.
 */
export async function rememberedCategories(
  drafts: ImportDraft[],
  memory: CategoryMemoryApi = categoryMemoryApi,
): Promise<Map<string, CategoryUpdate>> {
  const updates = new Map<string, CategoryUpdate>();
  for (const batch of categoryBatches(drafts, MEMORY_BATCH)) {
    let matches;
    try {
      matches = await memory.match(batch.items);
    } catch {
      return updates;
    }
    for (const { index, categoryId } of matches) {
      if (!categoryId) continue;
      for (const key of batch.keysByIndex.get(index) ?? []) {
        updates.set(key, { categoryId, source: "memory" });
      }
    }
  }
  return updates;
}

/**
 * Cheile rândurilor care există deja în aplicație (fișier importat a doua oară), dintr-un singur apel.
 * `failed`: verificarea nu a reușit; importul continuă fără ea.
 */
export async function existingDrafts(
  drafts: ImportDraft[],
  api: Pick<TransactionsApi, "findExisting"> = transactionsApi,
): Promise<{ keys: Set<string>; failed: boolean }> {
  const items = existingCheckItems(drafts);
  if (items.length === 0) return { keys: new Set(), failed: false };
  try {
    const indexes = await api.findExisting(items);
    return {
      keys: new Set(
        indexes.flatMap((i) => (drafts[i] ? [drafts[i].key] : [])),
      ),
      failed: false,
    };
  } catch {
    return { keys: new Set(), failed: true };
  }
}

/**
 * Ce învață memoria la salvarea importului: categoria păstrată pentru fiecare rând; un rând e o corectură
 * dacă utilizatorul a înlocuit categoria propusă de memorie sau de AI.
 */
export function memoryLessons(drafts: ImportDraft[]): CategoryMemoryLesson[] {
  return drafts
    .filter((d) => d.categoryId && d.description.trim())
    .map((d) => ({
      description: d.description.trim(),
      type: d.type,
      categoryId: d.categoryId,
      corrected:
        !!d.suggestedCategoryId && d.suggestedCategoryId !== d.categoryId,
    }));
}

/**
 * Cere AI-ului categoriile pentru rândurile fără categorie, pe loturi; `onProgress` primește rezultatele
 * fiecărui lot. Întoarce mesajul erorii dacă AI-ul a eșuat (rândurile rămase se aleg manual).
 */
export async function suggestMissingCategories(
  drafts: ImportDraft[],
  onProgress: (
    updates: Map<string, CategoryUpdate>,
    done: number,
    total: number,
  ) => void,
  isCancelled: () => boolean,
  ai: TransactionImportAiApi = transactionImportAiApi,
  batchSize?: number,
): Promise<string | null> {
  const batches = categoryBatches(drafts, batchSize);
  const total = batches.reduce((sum, b) => sum + b.items.length, 0);
  let done = 0;
  for (const batch of batches) {
    if (isCancelled()) return null;
    let suggestions;
    try {
      suggestions = await ai.suggestCategories(batch.items);
    } catch (error) {
      return getErrorMessage(error, "AI-ul nu a putut alege categoriile.");
    }
    if (isCancelled()) return null;
    const updates = new Map<string, CategoryUpdate>();
    for (const item of batch.items) {
      const categoryId =
        suggestions.find((s) => s.index === item.index)?.categoryId ?? null;
      for (const key of batch.keysByIndex.get(item.index) ?? []) {
        updates.set(key, { categoryId, source: "ai" });
      }
    }
    done += batch.items.length;
    onProgress(updates, done, total);
  }
  return null;
}
