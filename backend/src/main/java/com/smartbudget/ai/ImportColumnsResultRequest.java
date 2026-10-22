package com.smartbudget.ai;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The raw answer of a browser-run model for column detection. */
public record ImportColumnsResultRequest(
        @NotBlank(message = "Răspunsul modelului este obligatoriu")
        @Size(max = LocalAiLimits.MAX_CONTENT, message = "Răspunsul modelului este prea lung") String content,
        @Min(1) @Max(ImportAiLimits.MAX_COLUMNS) int columnCount) {
}
