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

/**
 * Ce conține fiecare coloană a fișierului importat (indici de la 0; `null` = lipsește).
 * `headerRow` este numărul (de la 1) al rândului cu titluri, `0` dacă fișierul nu are antet.
 */
export interface ImportColumnMapping {
  headerRow: number;
  date?: number | null;
  description?: number | null;
  amount?: number | null;
  debit?: number | null;
  credit?: number | null;
  type?: number | null;
  category?: number | null;
  /** Cum sunt scrise datele text: zi-lună-an, lună-zi-an sau an-lună-zi. */
  dateFormat?: "DMY" | "MDY" | "YMD";
  /** Din descriere se păstrează doar textul de dinaintea primei apariții a acestui separator (ex.: `,`). */
  descriptionCutAt?: string | null;
}

/** O tranzacție din fișier pentru care AI-ul trebuie să aleagă categoria. */
export interface ImportCategoryItem {
  index: number;
  description: string;
  type: TransactionType;
}

/** Un rând din fișier verificat la `POST /transactions/import/existing` (există deja în aplicație?). */
export interface ImportExistingItem {
  index: number;
  type: TransactionType;
  amount: number;
  description: string;
  transactionDate: IsoDate;
}

/** `categoryId` este `null` când AI-ul nu a fost sigur; utilizatorul alege atunci categoria. */
export interface ImportCategorySuggestion {
  index: number;
  categoryId: string | null;
}

/**
 * O categorie păstrată de utilizator la salvarea importului, din care aplicația învață.
 * `corrected`: utilizatorul a înlocuit categoria propusă (de AI sau din memorie).
 */
export interface CategoryMemoryLesson {
  description: string;
  type: TransactionType;
  categoryId: string;
  corrected: boolean;
}

/**
 * Un comerciant reținut: `key` sunt cuvintele care îl identifică, `categoryId` categoria folosită cel mai des.
 * `certain` este `false` când utilizatorul l-a pus în categorii diferite (importul nu îl completează singur).
 */
export interface RememberedMerchant {
  type: TransactionType;
  key: string;
  categoryId: string;
  hits: number;
  certain: boolean;
  updatedAt: string;
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
