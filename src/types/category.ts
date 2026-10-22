import type { TransactionType } from "./transaction";

export interface Category {
  id: number;
  name: string;
  type: TransactionType;
  /** Culoare hex opțională, folosită în grafice. */
  color?: string;
}
