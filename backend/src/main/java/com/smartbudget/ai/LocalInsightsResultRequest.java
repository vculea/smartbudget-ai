package com.smartbudget.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.YearMonth;

/** The raw answer of a local model plus the period it was generated for; it is validated like a cloud answer. */
public record LocalInsightsResultRequest(
        YearMonth month,
        Integer year,
        @NotBlank(message = "Răspunsul modelului este obligatoriu")
        @Size(max = LocalAiLimits.MAX_CONTENT, message = "Răspunsul modelului este prea lung") String content) {
}
