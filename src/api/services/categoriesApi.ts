import type { CategoriesApi } from "../contracts";
import { http } from "../http";
import type { Category } from "../../types";

export const httpCategoriesApi: CategoriesApi = {
  async list() {
    const { data } = await http.get<Category[]>("/categories");
    return data;
  },
};
