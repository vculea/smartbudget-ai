import type {
  AiInsightsRequest,
  AiInsightsResponse,
  Budget,
  BudgetInput,
  BudgetPlan,
  BudgetYearInput,
  BudgetYearResult,
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
  IncomePlan,
  Page,
  RememberedMerchant,
  ScanOptions,
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
  /** Trimite poza unui bon / extras către AI și întoarce tranzacțiile propuse (nesalvate, cel puțin una). */
  scan(image: Blob, options?: ScanOptions): Promise<TransactionScan[]>;
  /** Salvează bonul / factura (PDF sau poză, max 8 MB) în Google Drive și îl leagă de tranzacție; înlocuiește fișierul anterior. */
  attach(id: string, file: Blob, fileName: string): Promise<Transaction>;
  /** Scoate fișierul din tranzacție (în Drive ajunge în coșul de gunoi, recuperabil 30 de zile). */
  detach(id: string): Promise<Transaction>;
}

export interface DriveApi {
  /** `enabled` este fals când backendul nu are configurat contul Google Drive. */
  status(): Promise<{ enabled: boolean }>;
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
  /** Doar bugetele de cheltuieli. */
  list(period: Period): Promise<Budget[]>;
  /** Veniturile planificate (bugete pe categorii de venit). */
  listIncome(period: Period): Promise<IncomePlan[]>;
  create(input: BudgetInput): Promise<Budget>;
  /** Creează limitele și veniturile planificate ale unui an; lunile care au deja sumă pe categorie rămân neschimbate. */
  createForYear(input: BudgetYearInput): Promise<BudgetYearResult>;
}

export interface BudgetPlanAiApi {
  /** AI-ul propune limite și venituri lunare pentru un an, pe baza anului ales și a anului anterior. */
  suggest(year: number): Promise<BudgetPlan>;
}

export interface GoalsApi {
  list(): Promise<Goal[]>;
  create(input: GoalInput): Promise<Goal>;
  contribute(id: string, input: ContributionInput): Promise<Goal>;
}

export interface AiInsightsApi {
  analyze(request: AiInsightsRequest): Promise<AiInsightsResponse>;
}
