package com.smartbudget.ai;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/ai/local")
@Tag(name = "AI Financial Coach (local model)")
public class LocalAiController {

    private final LocalAiService service;

    public LocalAiController(LocalAiService service) {
        this.service = service;
    }

    @PostMapping("/insights/prompt")
    @Operation(summary = "Prompt for generating recommendations with a model run by the browser",
            description = "Returns the system prompt and the aggregated summary (computed from MongoDB). "
                    + "Send either month (YYYY-MM) or year (YYYY). Errors: 422 no data.")
    public LocalInsightsPrompt insightsPrompt(@RequestBody(required = false) AiInsightsRequest request) {
        return service.insightsPrompt(request);
    }

    @PostMapping("/insights/result")
    @Operation(summary = "Validates the answer of a model run by the browser",
            description = "Parses and validates the raw model answer against figures recomputed from MongoDB. "
                    + "Errors: 422 no data, 502 invalid AI answer.")
    public AiInsightsResponse insightsResult(@Valid @RequestBody LocalInsightsResultRequest request) {
        return service.insightsResult(new AiInsightsRequest(request.month(), request.year()), request.content());
    }

    @GetMapping("/receipt/prompt")
    @Operation(summary = "Prompt for reading a receipt photo with a vision model run by the browser")
    public LocalReceiptPrompt receiptPrompt() {
        return service.receiptPrompt();
    }

    @PostMapping("/receipt/result")
    @Operation(summary = "Validates the receipt answer of a vision model run by the browser",
            description = "Returns {transactions: [...]}. Errors: 422 nothing recognizable, 502 invalid AI answer.")
    public ReceiptScanResult receiptResult(@Valid @RequestBody LocalReceiptResultRequest request) {
        return service.receiptResult(request.content());
    }
}
