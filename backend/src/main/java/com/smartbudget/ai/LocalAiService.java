package com.smartbudget.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartbudget.category.CategoryService;
import com.smartbudget.common.Years;
import com.smartbudget.dashboard.DashboardResponse;
import com.smartbudget.dashboard.DashboardService;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import org.springframework.stereotype.Service;

/**
 * Support for AI models that run on the user's machine (e.g. Ollama) and are called by the browser, which a
 * cloud-hosted backend cannot reach. The backend still computes the figures and validates the answer; it just
 * never talks to the model itself.
 */
@Service
public class LocalAiService {

    private final DashboardService dashboardService;
    private final CategoryService categoryService;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public LocalAiService(DashboardService dashboardService, CategoryService categoryService,
            ObjectMapper objectMapper, Clock clock) {
        this.dashboardService = dashboardService;
        this.categoryService = categoryService;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public LocalInsightsPrompt insightsPrompt(AiInsightsRequest period) {
        FinancialSummary summary = AiInsightsService.requireSummary(dashboard(period));
        return new LocalInsightsPrompt(summary.month(), OpenAiCompatibleAnalysisService.SYSTEM_PROMPT,
                OpenAiCompatibleAnalysisService.userMessage(objectMapper, summary));
    }

    public AiInsightsResponse insightsResult(AiInsightsRequest period, String content) {
        DashboardResponse dashboard = dashboard(period);
        AiAnalysis analysis = new AiResponseParser(objectMapper).parse(content,
                AiInsightsService.requireSummary(dashboard));
        return new AiInsightsResponse(dashboard.month(), analysis.summary(), analysis.insights(), clock.instant());
    }

    public LocalReceiptPrompt receiptPrompt() {
        return new LocalReceiptPrompt(
                OpenAiCompatibleReceiptScanner.systemPrompt(objectMapper, categoryService.list(), LocalDate.now(clock)),
                OpenAiCompatibleReceiptScanner.USER_TEXT);
    }

    public ReceiptScanResult receiptResult(String content) {
        return OpenAiCompatibleReceiptScanner.parse(objectMapper, content, categoryService.list(),
                LocalDate.now(clock));
    }

    private DashboardResponse dashboard(AiInsightsRequest period) {
        if (period != null) {
            Years.requireSingleSelector(period.month(), period.year());
            if (period.year() != null) {
                return dashboardService.getForYear(Years.require(period.year()));
            }
        }
        YearMonth month = period != null && period.month() != null ? period.month() : YearMonth.now(clock);
        return dashboardService.get(month);
    }
}
