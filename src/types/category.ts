import type { TransactionType } from "./transaction";

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  /** Culoare hex opțională, folosită în grafice. */
  color?: string | null;
  icon?: string | null;
}

export interface CategoryInput {
  name: string;
  type: TransactionType;
  color?: string | null;
  icon?: string | null;
}

/** Câte tranzacții și bugete ale utilizatorului folosesc o categorie. */
export interface CategoryUsage {
  transactions: number;
  budgets: number;
}
