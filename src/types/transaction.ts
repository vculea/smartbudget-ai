import type { IsoDate, SortDirection } from "./common";

export type TransactionType = "INCOME" | "EXPENSE";

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  description: string;
  transactionDate: IsoDate;
  categoryId: number;
  categoryName?: string;
}

/** Corp pentru `POST /transactions` și `PUT /transactions/{id}`. */
export interface TransactionInput {
  type: TransactionType;
  amount: number;
  description: string;
  transactionDate: IsoDate;
  categoryId: number;
}

export type TransactionSortField = "transactionDate" | "amount";

/** Parametrii pentru `GET /transactions`. `page` începe de la 0. */
export interface TransactionQuery {
  page: number;
  size: number;
  type?: TransactionType;
  categoryId?: number;
  startDate?: IsoDate;
  endDate?: IsoDate;
  search?: string;
  sortBy: TransactionSortField;
  sortDir: SortDirection;
}
