package com.smartbudget.ai;

import java.math.BigDecimal;
import java.util.List;

public record AiAnalysis(String summary, List<Insight> insights) {

    public enum Priority {
        LOW,
        MEDIUM,
        HIGH
    }

    public record Insight(String title, String reason, BigDecimal suggestedMonthlySaving, Priority priority) {
    }
}
