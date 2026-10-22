import type { TransactionsApi } from "../contracts";
import { http } from "../http";
import type { Page, Transaction } from "../../types";

export const httpTransactionsApi: TransactionsApi = {
  async list(query) {
    const { sortBy, sortDir, search, ...rest } = query;
    const { data } = await http.get<Page<Transaction>>("/transactions", {
      params: {
        ...rest,
        search: search?.trim() || undefined,
        sort: `${sortBy},${sortDir}`,
      },
    });
    return data;
  },
  async create(input) {
    const { data } = await http.post<Transaction>("/transactions", input);
    return data;
  },
  async update(id, input) {
    const { data } = await http.put<Transaction>(`/transactions/${id}`, input);
    return data;
  },
  async remove(id) {
    await http.delete(`/transactions/${id}`);
  },
};
