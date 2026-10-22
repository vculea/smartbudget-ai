import type { YearMonth } from "./common";

export type RecommendationPriority = "HIGH" | "MEDIUM" | "LOW";

export interface AiRecommendation {
  id: string;
  title: string;
  explanation: string;
  priority: RecommendationPriority;
  /** Estimare orientativă, nu o garanție. */
  estimatedMonthlySavings: number;
  categoryId?: number | null;
}

/** Corp pentru `POST /ai/insights`. */
export interface AiInsightsRequest {
  month?: YearMonth;
}

export interface AiInsightsResponse {
  summary: string;
  recommendations: AiRecommendation[];
  generatedAt: string;
}
