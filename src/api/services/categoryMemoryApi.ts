import type { CategoryMemoryApi } from "../contracts";
import { http } from "../http";
import type { ImportCategorySuggestion, RememberedMerchant } from "../../types";

export const httpCategoryMemoryApi: CategoryMemoryApi = {
  async match(items) {
    const { data } = await http.post<{
      suggestions: ImportCategorySuggestion[];
    }>("/category-memory/match", { items });
    return data.suggestions;
  },
  async learn(lessons) {
    await http.post("/category-memory/learn", { entries: lessons });
  },
  async list() {
    const { data } = await http.get<RememberedMerchant[]>("/category-memory");
    return data;
  },
  async forget(type, key) {
    await http.delete("/category-memory", { params: { type, key } });
  },
  async forgetAll() {
    await http.delete("/category-memory/all");
  },
};
