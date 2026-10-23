import { env } from "../config/env";
import {
  mockAiInsightsApi,
  mockBudgetPlanAiApi,
  mockBudgetsApi,
  mockCategoriesApi,
  mockCategoryMemoryApi,
  mockDashboardApi,
  mockDriveApi,
  mockGoalsApi,
  mockTransactionImportAiApi,
  mockTransactionsApi,
} from "../mocks/mockApi";
import type {
  AiInsightsApi,
  BudgetPlanAiApi,
  BudgetsApi,
  CategoriesApi,
  CategoryMemoryApi,
  DashboardApi,
  DriveApi,
  GoalsApi,
  TransactionImportAiApi,
  TransactionsApi,
} from "./contracts";
import { httpAiInsightsApi } from "./services/aiInsightsApi";
import { httpBudgetPlanAiApi, httpBudgetsApi } from "./services/budgetsApi";
import { httpCategoriesApi } from "./services/categoriesApi";
import { httpCategoryMemoryApi } from "./services/categoryMemoryApi";
import { httpDashboardApi } from "./services/dashboardApi";
import { httpDriveApi } from "./services/driveApi";
import { httpGoalsApi } from "./services/goalsApi";
import { httpImportAiApi } from "./services/importAiApi";
import { httpTransactionsApi } from "./services/transactionsApi";
import {
  localAiInsightsApi,
  localBudgetPlanAiApi,
  localImportAiApi,
  localScanTransaction,
} from "./services/localAiApi";
import { getBrowserAiConfig, loadAiSettings } from "../config/aiSettings";

// Alegere explicită în funcție de VITE_DEMO_MODE; nu există fallback automat la mock.
export const dashboardApi: DashboardApi = env.demoMode
  ? mockDashboardApi
  : httpDashboardApi;
// Funcțiile AI aleg la fiecare apel între serverul aplicației și modelul local al utilizatorului (Setări AI).
export const transactionsApi: TransactionsApi = env.demoMode
  ? mockTransactionsApi
  : {
      ...httpTransactionsApi,
      scan: (image, options) =>
        getBrowserAiConfig(loadAiSettings())
          ? localScanTransaction(image, options)
          : httpTransactionsApi.scan(image, options),
    };
// Importul CSV/Excel folosește AI-ul ales în Setări AI (server, model local sau cheie proprie).
export const transactionImportAiApi: TransactionImportAiApi = env.demoMode
  ? mockTransactionImportAiApi
  : {
      detectColumns: (rows) =>
        getBrowserAiConfig(loadAiSettings())
          ? localImportAiApi.detectColumns(rows)
          : httpImportAiApi.detectColumns(rows),
      suggestCategories: (items) =>
        getBrowserAiConfig(loadAiSettings())
          ? localImportAiApi.suggestCategories(items)
          : httpImportAiApi.suggestCategories(items),
    };
export const categoriesApi: CategoriesApi = env.demoMode
  ? mockCategoriesApi
  : httpCategoriesApi;
export const categoryMemoryApi: CategoryMemoryApi = env.demoMode
  ? mockCategoryMemoryApi
  : httpCategoryMemoryApi;
export const budgetsApi: BudgetsApi = env.demoMode
  ? mockBudgetsApi
  : httpBudgetsApi;
export const budgetPlanAiApi: BudgetPlanAiApi = env.demoMode
  ? mockBudgetPlanAiApi
  : {
      suggest: (year) =>
        getBrowserAiConfig(loadAiSettings())
          ? localBudgetPlanAiApi.suggest(year)
          : httpBudgetPlanAiApi.suggest(year),
    };
export const driveApi: DriveApi = env.demoMode ? mockDriveApi : httpDriveApi;
export const goalsApi: GoalsApi = env.demoMode ? mockGoalsApi : httpGoalsApi;
export const aiInsightsApi: AiInsightsApi = env.demoMode
  ? mockAiInsightsApi
  : {
      analyze: (request) =>
        getBrowserAiConfig(loadAiSettings())
          ? localAiInsightsApi.analyze(request)
          : httpAiInsightsApi.analyze(request),
    };

export { ApiError, getErrorMessage } from "./errors";
export { queryKeys } from "./queryKeys";
