package com.smartbudget.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.smartbudget.TestClock;
import com.smartbudget.category.CategoryResponse;
import com.smartbudget.category.CategoryService;
import com.smartbudget.common.ApiException;
import com.smartbudget.dashboard.DashboardResponse;
import com.smartbudget.dashboard.DashboardService;
import com.smartbudget.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class LocalAiServiceTest {

    private static final YearMonth MONTH = YearMonth.of(2026, 9);

    private final DashboardService dashboard = mock(DashboardService.class);
    private final CategoryService categories = mock(CategoryService.class);
    private LocalAiService service;

    @BeforeEach
    void setUp() {
        service = new LocalAiService(dashboard, categories, AiTestData.MAPPER, TestClock.FIXED);
    }

    @Test
    void insightsPromptContainsTheRecomputedSummaryAndTheSystemPrompt() {
        when(dashboard.get(MONTH)).thenReturn(dashboard("6000.00", "4500.00"));

        LocalInsightsPrompt prompt = service.insightsPrompt(new AiInsightsRequest(MONTH, null));

        assertThat(prompt.period()).isEqualTo("2026-09");
        assertThat(prompt.systemPrompt()).isEqualTo(OpenAiCompatibleAnalysisService.SYSTEM_PROMPT);
        assertThat(prompt.userMessage()).startsWith("Financial summary (JSON):").contains("4500");
    }

    @Test
    void insightsPromptRefusesPeriodsWithoutData() {
        when(dashboard.get(MONTH)).thenReturn(dashboard("0.00", "0.00"));

        assertThatThrownBy(() -> service.insightsPrompt(new AiInsightsRequest(MONTH, null)))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY));
    }

    @Test
    void insightsPromptRejectsMonthAndYearTogether() {
        assertThatThrownBy(() -> service.insightsPrompt(new AiInsightsRequest(MONTH, 2026)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void insightsResultValidatesTheAnswerAgainstServerFigures() {
        when(dashboard.get(MONTH)).thenReturn(dashboard("6000.00", "4500.00"));

        AiInsightsResponse response = service.insightsResult(new AiInsightsRequest(MONTH, null), AiTestData.validJson());

        assertThat(response.month()).isEqualTo("2026-09");
        assertThat(response.insights()).hasSize(2);
        assertThat(response.generatedAt()).isEqualTo(TestClock.FIXED.instant());
    }

    @Test
    void insightsResultRejectsASavingAboveTheRealExpenses() {
        when(dashboard.get(MONTH)).thenReturn(dashboard("6000.00", "100.00"));

        assertThatThrownBy(() -> service.insightsResult(new AiInsightsRequest(MONTH, null), AiTestData.validJson()))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    void receiptPromptListsTheCategoriesAndTodaysDate() {
        when(categories.list()).thenReturn(List.of(
                new CategoryResponse("food", "Alimente", TransactionType.EXPENSE, "#fff", "cart")));

        LocalReceiptPrompt prompt = service.receiptPrompt();

        assertThat(prompt.systemPrompt()).contains("\"id\":\"food\"").contains("2026-10-22");
        assertThat(prompt.userText()).isNotBlank();
    }

    @Test
    void receiptResultParsesAndValidatesTheAnswer() {
        when(categories.list()).thenReturn(List.of(
                new CategoryResponse("food", "Alimente", TransactionType.EXPENSE, "#fff", "cart")));

        ReceiptScan scan = service.receiptResult(
                "{\"transactions\":[{\"type\":\"EXPENSE\",\"amount\":\"12,50\",\"description\":\"Lidl\","
                        + "\"transactionDate\":\"2026-10-20\",\"categoryId\":\"food\"}]}").transactions().get(0);

        assertThat(scan.amount()).isEqualByComparingTo("12.50");
        assertThat(scan.categoryId()).isEqualTo("food");
    }

    @Test
    void receiptResultRejectsNonJsonAnswers() {
        when(categories.list()).thenReturn(List.of());

        assertThatThrownBy(() -> service.receiptResult("nu e json"))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    private static DashboardResponse dashboard(String income, String expenses) {
        BigDecimal inc = new BigDecimal(income);
        BigDecimal exp = new BigDecimal(expenses);
        return new DashboardResponse(MONTH.toString(), inc, exp, inc.subtract(exp), new BigDecimal("25.00"),
                new BigDecimal("70.00"), List.of(), List.of(),
                List.of(new DashboardResponse.MonthlyTrendPoint(MONTH, inc, exp)), List.of(), List.of(), List.of());
    }
}
