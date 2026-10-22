import { env } from "../config/env";
import {
  mockAiInsightsApi,
  mockBudgetsApi,
  mockCategoriesApi,
  mockDashboardApi,
  mockGoalsApi,
  mockTransactionsApi,
} from "../mocks/mockApi";
import type {
  AiInsightsApi,
  BudgetsApi,
  CategoriesApi,
  DashboardApi,
  GoalsApi,
  TransactionsApi,
} from "./contracts";
import { httpAiInsightsApi } from "./services/aiInsightsApi";
import { httpBudgetsApi } from "./services/budgetsApi";
import { httpCategoriesApi } from "./services/categoriesApi";
import { httpDashboardApi } from "./services/dashboardApi";
import { httpGoalsApi } from "./services/goalsApi";
import { httpTransactionsApi } from "./services/transactionsApi";
import {
  localAiInsightsApi,
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
      scan: (image) =>
        getBrowserAiConfig(loadAiSettings())
          ? localScanTransaction(image)
          : httpTransactionsApi.scan(image),
    };
export const categoriesApi: CategoriesApi = env.demoMode
  ? mockCategoriesApi
  : httpCategoriesApi;
export const budgetsApi: BudgetsApi = env.demoMode
  ? mockBudgetsApi
  : httpBudgetsApi;
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
