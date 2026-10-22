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
