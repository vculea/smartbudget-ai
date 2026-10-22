import { useMutation } from "@tanstack/react-query";
import { aiInsightsApi } from "../../api";
import type { AiInsightsRequest } from "../../types";

// Eroarea este afișată în pagină, cu opțiunea de reîncercare, deci fără toast.
export function useAiAnalysis() {
  return useMutation({
    mutationFn: (request: AiInsightsRequest) => aiInsightsApi.analyze(request),
  });
}
