import { getErrorMessage, transactionImportAiApi } from "../../../api";
import type { TransactionImportAiApi } from "../../../api/contracts";
import type { Category } from "../../../types";
import {
  ImportFileError,
  buildDrafts,
  categoryBatches,
  detectColumnsByHeader,
  checkMapping,
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
        updates.set(key, { categoryId });
      }
    }
    done += batch.items.length;
    onProgress(updates, done, total);
  }
  return null;
}
