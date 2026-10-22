/** Lună în format `YYYY-MM`. */
export type YearMonth = string;

/** Dată în format ISO `YYYY-MM-DD`. */
export type IsoDate = string;

export type SortDirection = "asc" | "desc";

/** Răspuns paginat (structura `Page` din Spring Data, simplificată). */
export interface Page<T> {
  content: T[];
  /** Index de pagină, începând de la 0. */
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Forma erorilor returnate de backend. */
export interface ApiErrorBody {
  status?: number;
  message?: string;
  fieldErrors?: Record<string, string>;
}
