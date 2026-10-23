import type { TransactionsApi } from "../contracts";
import { http } from "../http";
import type { Page, Transaction, TransactionScan } from "../../types";

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
  async createMany(inputs) {
    const { data } = await http.post<{ created: number }>(
      "/transactions/bulk",
      { transactions: inputs },
    );
    return data;
  },
  async findExisting(items) {
    const { data } = await http.post<{ indexes: number[] }>(
      "/transactions/import/existing",
      { items },
    );
    return data.indexes;
  },
  async update(id, input) {
    const { data } = await http.put<Transaction>(`/transactions/${id}`, input);
    return data;
  },
  async remove(id) {
    await http.delete(`/transactions/${id}`);
  },
  // Citirea pozei de către modelul AI local poate dura (la fel ca analiza AI).
  async scan(image, options) {
    const body = new FormData();
    body.append("image", image, "bon.jpg");
    const { data } = await http.post<{ transactions: TransactionScan[] }>(
      "/transactions/scan",
      body,
      {
        timeout: 180_000,
        headers: { "Content-Type": "multipart/form-data" },
        signal: options?.signal,
      },
    );
    return data.transactions;
  },
  async attach(id, file, fileName) {
    const body = new FormData();
    body.append("file", file, fileName);
    const { data } = await http.post<Transaction>(
      `/transactions/${id}/attachment`,
      body,
      { timeout: 60_000, headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },
  async detach(id) {
    const { data } = await http.delete<Transaction>(
      `/transactions/${id}/attachment`,
    );
    return data;
  },
};
