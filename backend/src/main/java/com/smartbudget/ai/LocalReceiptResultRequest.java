package com.smartbudget.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The raw answer of a local vision model; it is validated like a cloud answer. */
public record LocalReceiptResultRequest(
        @NotBlank(message = "Răspunsul modelului este obligatoriu")
        @Size(max = LocalAiLimits.MAX_CONTENT, message = "Răspunsul modelului este prea lung") String content) {
}
