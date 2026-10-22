package com.smartbudget.ai;

import java.time.Instant;
import java.time.YearMonth;
import java.util.List;

public record AiInsightsResponse(YearMonth month, String summary, List<AiAnalysis.Insight> insights,
                                 Instant generatedAt) {
}
