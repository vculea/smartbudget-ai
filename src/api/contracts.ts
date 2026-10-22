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
  YearMonth,
} from "../types";

/** Contractele serviciilor; implementate de clientul HTTP real și de mock-ul demo. */
export interface DashboardApi {
  get(month: YearMonth): Promise<DashboardResponse>;
}

export interface TransactionsApi {
  list(query: TransactionQuery): Promise<Page<Transaction>>;
  create(input: TransactionInput): Promise<Transaction>;
  update(id: number, input: TransactionInput): Promise<Transaction>;
  remove(id: number): Promise<void>;
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
  contribute(id: number, input: ContributionInput): Promise<Goal>;
}

export interface AiInsightsApi {
  analyze(request: AiInsightsRequest): Promise<AiInsightsResponse>;
}
