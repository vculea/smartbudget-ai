import type { AiInsightsApi } from "../contracts";
import { http } from "../http";
import type { AiInsightsResponse } from "../../types";

// Analiza AI rulează exclusiv în backend; răspunsul poate dura mai mult.
export const httpAiInsightsApi: AiInsightsApi = {
  async analyze(request) {
    const { data } = await http.post<AiInsightsResponse>(
      "/ai/insights",
      request,
      { timeout: 60_000 },
    );
    return data;
  },
};
