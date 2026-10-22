import type { CategoriesApi } from "../contracts";
import { http } from "../http";
import type { Category, CategoryUsage } from "../../types";

export const httpCategoriesApi: CategoriesApi = {
  async list() {
    const { data } = await http.get<Category[]>("/categories");
    return data;
  },
  async create(input) {
    const { data } = await http.post<Category>("/categories", input);
    return data;
  },
  async update(id, input) {
    const { data } = await http.put<Category>(`/categories/${id}`, input);
    return data;
  },
  async usage(id) {
    const { data } = await http.get<CategoryUsage>(`/categories/${id}/usage`);
    return data;
  },
  async remove(id, replacementId) {
    await http.delete(`/categories/${id}`, {
      params: replacementId ? { replacementId } : undefined,
    });
  },
};
