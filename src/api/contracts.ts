import type {
  AiInsightsRequest,
  AiInsightsResponse,
  Budget,
  BudgetInput,
  Category,
  ContributionInput,
  DashboardResponse,
  Goal,
  GoalInput,
  ImportCategoryItem,
  ImportCategorySuggestion,
  ImportColumnMapping,
  Page,
  Transaction,
  TransactionInput,
  TransactionQuery,
  TransactionScan,
  Period,
} from "../types";

/** Contractele serviciilor; implementate de clientul HTTP real și de mock-ul demo. */
export interface DashboardApi {
  get(period: Period): Promise<DashboardResponse>;
}

export interface TransactionsApi {
  list(query: TransactionQuery): Promise<Page<Transaction>>;
  create(input: TransactionInput): Promise<Transaction>;
  /** Salvează mai multe tranzacții deodată (import CSV/Excel); totul sau nimic. */
  createMany(inputs: TransactionInput[]): Promise<{ created: number }>;
  update(id: string, input: TransactionInput): Promise<Transaction>;
  remove(id: string): Promise<void>;
  /** Trimite poza unui bon către AI și întoarce tranzacția propusă (nesalvată). */
  scan(image: Blob): Promise<TransactionScan>;
}

export interface TransactionImportAiApi {
  /** AI-ul recunoaște coloanele din primele rânduri ale fișierului. */
  detectColumns(rows: string[][]): Promise<ImportColumnMapping>;
  /** AI-ul propune categorii (maxim 60 de tranzacții); `categoryId: null` = nu e sigur. */
  suggestCategories(
    items: ImportCategoryItem[],
  ): Promise<ImportCategorySuggestion[]>;
}

export interface CategoriesApi {
  list(): Promise<Category[]>;
}

export interface BudgetsApi {
  list(period: Period): Promise<Budget[]>;
  create(input: BudgetInput): Promise<Budget>;
}

export interface GoalsApi {
  list(): Promise<Goal[]>;
  create(input: GoalInput): Promise<Goal>;
  contribute(id: string, input: ContributionInput): Promise<Goal>;
}

export interface AiInsightsApi {
  analyze(request: AiInsightsRequest): Promise<AiInsightsResponse>;
}
