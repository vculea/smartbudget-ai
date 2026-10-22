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
  Page,
  Transaction,
  TransactionInput,
  TransactionQuery,
  TransactionScan,
  YearMonth,
} from "../types";

/** Contractele serviciilor; implementate de clientul HTTP real și de mock-ul demo. */
export interface DashboardApi {
  get(month: YearMonth): Promise<DashboardResponse>;
}

export interface TransactionsApi {
  list(query: TransactionQuery): Promise<Page<Transaction>>;
  create(input: TransactionInput): Promise<Transaction>;
  update(id: string, input: TransactionInput): Promise<Transaction>;
  remove(id: string): Promise<void>;
  /** Trimite poza unui bon către AI și întoarce tranzacția propusă (nesalvată). */
  scan(image: Blob): Promise<TransactionScan>;
}

export interface CategoriesApi {
  list(): Promise<Category[]>;
}

export interface BudgetsApi {
  list(month: YearMonth): Promise<Budget[]>;
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
