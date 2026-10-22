import type { TransactionType } from "./transaction";

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  /** Culoare hex opțională, folosită în grafice. */
  color?: string | null;
  icon?: string | null;
}
