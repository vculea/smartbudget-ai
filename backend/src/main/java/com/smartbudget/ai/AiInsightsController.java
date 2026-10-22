package com.smartbudget.ai;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/ai")
@Tag(name = "AI Financial Coach")
public class AiInsightsController {

    private final AiInsightsService service;

    public AiInsightsController(AiInsightsService service) {
        this.service = service;
    }

    @PostMapping("/insights")
    @Operation(summary = "Generate up to 3 AI recommendations for a month",
            description = "The backend computes the figures from MongoDB and sends only an aggregated summary to the AI provider. "
                    + "Errors: 422 no data, 429 provider rate limit, 502 invalid AI answer / provider auth, "
                    + "503 provider unavailable or not configured, 504 provider timeout.")
    public AiInsightsResponse insights(@RequestBody(required = false) AiInsightsRequest request) {
        return service.generate(request == null ? null : request.month());
    }
}
