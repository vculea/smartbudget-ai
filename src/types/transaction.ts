import type { IsoDate, SortDirection } from "./common";

export type TransactionType = "INCOME" | "EXPENSE";

export interface Transaction {
  /** Identificator MongoDB (ObjectId hex), transmis ca string. */
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  transactionDate: IsoDate;
  categoryId: string;
  categoryName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Corp pentru `POST /transactions` și `PUT /transactions/{id}`. */
export interface TransactionInput {
  type: TransactionType;
  amount: number;
  description: string;
  transactionDate: IsoDate;
  categoryId: string;
}

export type TransactionSortField = "transactionDate" | "amount";

/**
 * Câmpurile propuse de `POST /transactions/scan` dintr-o poză. Sunt doar sugestii:
 * `amount` și `categoryId` pot lipsi când AI-ul nu le-a putut citi.
 */
export interface TransactionScan {
  type: TransactionType;
  amount: number | null;
  description: string;
  transactionDate: IsoDate;
  categoryId: string | null;
}

/** Parametrii pentru `GET /transactions`. `page` începe de la 0. */
export interface TransactionQuery {
  page: number;
  size: number;
  type?: TransactionType;
  categoryId?: string;
  startDate?: IsoDate;
  endDate?: IsoDate;
  search?: string;
  sortBy: TransactionSortField;
  sortDir: SortDirection;
}
