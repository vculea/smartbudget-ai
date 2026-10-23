import type {
  AiInsightsRequest,
  AiInsightsResponse,
  Budget,
  BudgetInput,
  Category,
  CategoryInput,
  CategoryMemoryLesson,
  CategoryUsage,
  ContributionInput,
  DashboardResponse,
  Goal,
  GoalInput,
  ImportCategoryItem,
  ImportCategorySuggestion,
  ImportColumnMapping,
  ImportExistingItem,
  Page,
  RememberedMerchant,
  Transaction,
  TransactionInput,
  TransactionQuery,
  TransactionScan,
  TransactionType,
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
  /**
   * Indicii rândurilor din import care există deja (același tip, dată, sumă și descriere);
   * fiecare tranzacție salvată acoperă un singur rând. Maxim 1000 de rânduri.
   */
  findExisting(items: ImportExistingItem[]): Promise<number[]>;
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

/** Ce categorii a ales utilizatorul pentru fiecare comerciant; importul le refolosește înainte de AI. */
export interface CategoryMemoryApi {
  /** Categoriile reținute (maxim 1000 de tranzacții); `categoryId: null` = comerciant necunoscut sau nehotărât. */
  match(items: ImportCategoryItem[]): Promise<ImportCategorySuggestion[]>;
  /** Reține categoriile păstrate la salvarea importului. */
  learn(lessons: CategoryMemoryLesson[]): Promise<void>;
  list(): Promise<RememberedMerchant[]>;
  forget(type: TransactionType, key: string): Promise<void>;
  forgetAll(): Promise<void>;
}

export interface CategoriesApi {
  list(): Promise<Category[]>;
  create(input: CategoryInput): Promise<Category>;
  update(id: string, input: CategoryInput): Promise<Category>;
  usage(id: string): Promise<CategoryUsage>;
  /** Dacă categoria e folosită, `replacementId` (același tip) primește tranzacțiile și bugetele ei. */
  remove(id: string, replacementId?: string): Promise<void>;
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
