import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { RequireAuth } from "../auth/RequireAuth";
import { LoginPage } from "../features/auth/LoginPage";
import { NotFoundPage } from "../features/not-found/NotFoundPage";

const DashboardPage = lazy(() =>
  import("../features/dashboard/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);
const TransactionsPage = lazy(() =>
  import("../features/transactions/TransactionsPage").then((m) => ({
    default: m.TransactionsPage,
  })),
);
const TransactionsImportPage = lazy(() =>
  import("../features/transactions/import/TransactionsImportPage").then(
    (m) => ({ default: m.TransactionsImportPage }),
  ),
);
const BudgetsPage = lazy(() =>
  import("../features/budgets/BudgetsPage").then((m) => ({
    default: m.BudgetsPage,
  })),
);
const GoalsPage = lazy(() =>
  import("../features/goals/GoalsPage").then((m) => ({ default: m.GoalsPage })),
);
const CategoriesPage = lazy(() =>
  import("../features/categories/CategoriesPage").then((m) => ({
    default: m.CategoriesPage,
  })),
);
const AiInsightsPage = lazy(() =>
  import("../features/ai-insights/AiInsightsPage").then((m) => ({
    default: m.AiInsightsPage,
  })),
);
const AiSettingsPage = lazy(() =>
  import("../features/settings/AiSettingsPage").then((m) => ({
    default: m.AiSettingsPage,
  })),
);

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route
            path="/transactions/import"
            element={<TransactionsImportPage />}
          />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/ai-insights" element={<AiInsightsPage />} />
          <Route path="/settings/ai" element={<AiSettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
