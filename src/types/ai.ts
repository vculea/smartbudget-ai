import type { YearMonth } from "./common";

export type RecommendationPriority = "HIGH" | "MEDIUM" | "LOW";

export interface AiRecommendation {
  id: string;
  title: string;
  explanation: string;
  priority: RecommendationPriority;
  /** Estimare orientativă, nu o garanție. */
  estimatedMonthlySavings: number;
  categoryId?: string | null;
}

/** Corp pentru `POST /ai/insights`: fie `month`, fie `year`. */
export interface AiInsightsRequest {
  month?: YearMonth;
  year?: number;
}

export interface AiInsightsResponse {
  summary: string;
  recommendations: AiRecommendation[];
  generatedAt: string;
}

/** Suma lunară propusă de AI pentru o categorie (`POST /ai/budget-plan`). */
export interface BudgetPlanItem {
  categoryId: string;
  categoryName: string;
  /** Limita de cheltuieli sau, pentru venituri, suma lunară așteptată. */
  monthlyAmount: number;
  reason: string;
  /** Media lunară din anii folosiți ca bază. */
  history: { year: number; monthlyAverage: number }[];
}

/** Propunere nesalvată; utilizatorul o revizuiește înainte de a crea bugetele. */
export interface BudgetPlan {
  year: number;
  /** Anii (doar lunile încheiate) pe care se bazează propunerea. */
  basedOnYears: number[];
  summary: string;
  /** Limite pentru categoriile de cheltuieli. */
  budgets: BudgetPlanItem[];
  /** Venituri așteptate pentru categoriile de venit. */
  incomes: BudgetPlanItem[];
  generatedAt: string;
}
