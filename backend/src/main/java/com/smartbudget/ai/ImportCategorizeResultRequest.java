package com.smartbudget.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/** The raw answer of a browser-run model for categorization, plus the items it was asked about. */
public record ImportCategorizeResultRequest(
        @NotBlank(message = "Răspunsul modelului este obligatoriu")
        @Size(max = LocalAiLimits.MAX_CONTENT, message = "Răspunsul modelului este prea lung") String content,
        @NotEmpty @Size(max = ImportAiLimits.MAX_ITEMS) List<@Valid ImportItem> items) {
}
