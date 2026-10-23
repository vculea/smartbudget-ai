package com.smartbudget.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** The raw answer of a model run by the browser, validated like a server answer. */
public record BudgetPlanResultRequest(
        @NotNull(message = "Anul este obligatoriu") Integer year,
        @NotBlank(message = "Răspunsul modelului este obligatoriu")
        @Size(max = LocalAiLimits.MAX_CONTENT, message = "Răspunsul modelului este prea lung") String content) {
}
