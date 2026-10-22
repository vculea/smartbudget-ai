package com.smartbudget.ai;

import com.smartbudget.common.Years;
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
    @Operation(summary = "Generate up to 3 AI recommendations for a month or a year",
            description = "The backend computes the figures from MongoDB and sends only an aggregated summary to the AI provider. "
                    + "Send either month (YYYY-MM) or year (YYYY); neither means the current month. "
                    + "Errors: 422 no data, 429 provider rate limit, 502 invalid AI answer / provider auth, "
                    + "503 provider unavailable or not configured, 504 provider timeout.")
    public AiInsightsResponse insights(@RequestBody(required = false) AiInsightsRequest request) {
        if (request != null) {
            Years.requireSingleSelector(request.month(), request.year());
            if (request.year() != null) {
                return service.generateForYear(Years.require(request.year()));
            }
        }
        return service.generate(request == null ? null : request.month());
    }
}
