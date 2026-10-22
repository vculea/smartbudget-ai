package com.smartbudget.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;

final class AiTestData {

    static final ObjectMapper MAPPER = JsonMapper.builder()
            .findAndAddModules()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .build();

    private AiTestData() {
    }

    static FinancialSummary summary() {
        return new FinancialSummary("2026-09", new BigDecimal("6000.00"), new BigDecimal("4500.00"),
                new BigDecimal("1500.00"), new BigDecimal("25.00"), new BigDecimal("70.00"),
                List.of(new FinancialSummary.CategorySpending("Chirie", new BigDecimal("1800.00"), new BigDecimal("40.00"))),
                List.of(), List.of(), List.of());
    }

    static String validJson() {
        return """
                {"summary": "Luna a fost echilibrată.",
                 "insights": [
                   {"title": "Redu cheltuielile la restaurante", "reason": "Ai cheltuit 250 RON.",
                    "suggestedMonthlySaving": 80.5, "priority": "medium"},
                   {"title": "Crește fondul de urgență", "reason": "Rata de economisire este 25%.",
                    "suggestedMonthlySaving": 200, "priority": "HIGH"}
                 ]}""";
    }
}
