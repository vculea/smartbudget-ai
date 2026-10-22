package com.smartbudget.ai;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/transactions/import")
@Tag(name = "Transaction import (AI)")
public class TransactionImportAiController {

    private final TransactionImportAiService service;

    public TransactionImportAiController(TransactionImportAiService service) {
        this.service = service;
    }

    @PostMapping("/columns")
    @Operation(summary = "Detect the columns of an uploaded CSV/Excel file with the server AI",
            description = "Body: the first rows of the file. Errors: 422 columns not recognized, "
                    + "429/502/503/504 AI provider problems.")
    public ImportColumnMapping columns(@Valid @RequestBody ImportColumnsRequest request) {
        return service.detectColumns(request);
    }

    @PostMapping("/columns/prompt")
    @Operation(summary = "Prompt for detecting columns with a model run by the browser")
    public ImportAiPrompt columnsPrompt(@Valid @RequestBody ImportColumnsRequest request) {
        return service.columnsPrompt(request);
    }

    @PostMapping("/columns/result")
    @Operation(summary = "Validates the column-detection answer of a model run by the browser",
            description = "Errors: 422 columns not recognized, 502 invalid AI answer.")
    public ImportColumnMapping columnsResult(@Valid @RequestBody ImportColumnsResultRequest request) {
        return service.columnsResult(request.content(), request.columnCount());
    }

    @PostMapping("/categories")
    @Operation(summary = "Suggest categories for imported transactions with the server AI",
            description = "Max 60 items per call. categoryId is null when the AI is not sure: the user then chooses.")
    public ImportCategorizeResponse categories(@Valid @RequestBody ImportCategorizeRequest request) {
        return service.categorize(request.items());
    }

    @PostMapping("/categories/prompt")
    @Operation(summary = "Prompt for categorizing imported transactions with a model run by the browser")
    public ImportAiPrompt categoriesPrompt(@Valid @RequestBody ImportCategorizeRequest request) {
        return service.categoriesPrompt(request.items());
    }

    @PostMapping("/categories/result")
    @Operation(summary = "Validates the categorization answer of a model run by the browser",
            description = "Unknown ids and categories of the wrong type become null. Errors: 502 invalid AI answer.")
    public ImportCategorizeResponse categoriesResult(@Valid @RequestBody ImportCategorizeResultRequest request) {
        return service.categoriesResult(request.content(), request.items());
    }
}
