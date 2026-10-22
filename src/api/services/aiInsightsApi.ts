import type { AiInsightsApi } from "../contracts";
import { http } from "../http";
import { ApiError } from "../errors";
import type {
  AiInsightsResponse,
  AiRecommendation,
  RecommendationPriority,
  YearMonth,
} from "../../types";

/** Forma exactă returnată de `POST /ai/insights` (AiInsightsResponse din backend). */
export interface AiInsightsWire {
  month?: YearMonth;
  summary: string;
  insights: {
    title: string;
    reason: string;
    suggestedMonthlySaving: number | null;
    priority: RecommendationPriority;
  }[];
  generatedAt: string;
}

/** Transformă răspunsul backendului în modelul folosit de UI. */
export function toAiInsightsResponse(wire: AiInsightsWire): AiInsightsResponse {
  if (!wire || !Array.isArray(wire.insights)) {
    throw new ApiError("Răspunsul serviciului AI are un format neașteptat.", 502);
  }
  const recommendations: AiRecommendation[] = wire.insights.map(
    (insight, index) => ({
      id: `${wire.month ?? "ai"}-${index}`,
      title: insight.title,
      explanation: insight.reason,
      priority: insight.priority,
      estimatedMonthlySavings: Number(insight.suggestedMonthlySaving ?? 0),
    }),
  );
  return {
    summary: wire.summary,
    recommendations,
    generatedAt: wire.generatedAt,
  };
}

// Analiza AI rulează exclusiv în backend; răspunsul poate dura mai mult.
export const httpAiInsightsApi: AiInsightsApi = {
  async analyze(request) {
    const { data } = await http.post<AiInsightsWire>(
      "/ai/insights",
      request,
      { timeout: 60_000 },
    );
    return toAiInsightsResponse(data);
  },
};
