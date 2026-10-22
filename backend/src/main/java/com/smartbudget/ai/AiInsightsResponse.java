package com.smartbudget.ai;

import java.time.Instant;
import java.util.List;

public record AiInsightsResponse(String month, String summary, List<AiAnalysis.Insight> insights,
                                 Instant generatedAt) {
}
