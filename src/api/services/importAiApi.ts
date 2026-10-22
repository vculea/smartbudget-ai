import type { TransactionImportAiApi } from "../contracts";
import { http } from "../http";
import type {
  ImportCategorySuggestion,
  ImportColumnMapping,
} from "../../types";

// Modelul AI local poate dura (la fel ca analiza AI și citirea bonurilor).
const AI_TIMEOUT = { timeout: 180_000 };

export const httpImportAiApi: TransactionImportAiApi = {
  async detectColumns(rows) {
    const { data } = await http.post<ImportColumnMapping>(
      "/transactions/import/columns",
      { rows },
      AI_TIMEOUT,
    );
    return data;
  },
  async suggestCategories(items) {
    const { data } = await http.post<{
      suggestions: ImportCategorySuggestion[];
    }>("/transactions/import/categories", { items }, AI_TIMEOUT);
    return data.suggestions;
  },
};
