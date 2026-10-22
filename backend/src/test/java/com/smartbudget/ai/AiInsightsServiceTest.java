package com.smartbudget.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smartbudget.TestClock;
import com.smartbudget.budget.BudgetResponse;
import com.smartbudget.budget.BudgetStatus;
import com.smartbudget.common.ApiException;
import com.smartbudget.dashboard.DashboardResponse;
import com.smartbudget.dashboard.DashboardService;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;

class AiInsightsServiceTest {

    private static final YearMonth MONTH = YearMonth.of(2026, 9);

    private final DashboardService dashboard = mock(DashboardService.class);
    private final AiAnalysisService ai = mock(AiAnalysisService.class);
    private AiInsightsService service;

    @BeforeEach
    void setUp() {
        service = new AiInsightsService(dashboard, ai, TestClock.FIXED);
    }

    @Test
    void sendsOnlyFiguresRecomputedFromTheDatabaseAndReturnsValidInsights() {
        when(dashboard.get(MONTH)).thenReturn(dashboard("6000.00", "4500.00"));
        AiAnalysis analysis = new AiAnalysis("ok", List.of(new AiAnalysis.Insight("t", "r", new BigDecimal("50.00"),
                AiAnalysis.Priority.LOW)));
        when(ai.analyze(any())).thenReturn(analysis);

        AiInsightsResponse response = service.generate(MONTH);

        ArgumentCaptor<FinancialSummary> captor = ArgumentCaptor.forClass(FinancialSummary.class);
        verify(ai).analyze(captor.capture());
        FinancialSummary sent = captor.getValue();
        assertThat(sent.totalIncome()).isEqualByComparingTo("6000.00");
        assertThat(sent.balance()).isEqualByComparingTo("1500.00");
        assertThat(sent.budgets()).extracting(FinancialSummary.BudgetUsage::category).containsExactly("Alimente");
        assertThat(sent.previousMonths()).isEmpty();
        assertThat(response.month()).isEqualTo(MONTH);
        assertThat(response.summary()).isEqualTo("ok");
        assertThat(response.insights()).hasSize(1);
        assertThat(response.generatedAt()).isEqualTo(TestClock.FIXED.instant());
    }

    @Test
    void doesNotCallProviderWhenMonthHasNoData() {
        when(dashboard.get(MONTH)).thenReturn(dashboard("0.00", "0.00"));

        assertThatThrownBy(() -> service.generate(MONTH))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY));
        verify(ai, never()).analyze(any());
    }

    @Test
    void propagatesProviderFailureInsteadOfInventingAnAnswer() {
        when(dashboard.get(MONTH)).thenReturn(dashboard("6000.00", "4500.00"));
        when(ai.analyze(any())).thenThrow(new ApiException(HttpStatus.GATEWAY_TIMEOUT, "timeout"));

        assertThatThrownBy(() -> service.generate(MONTH))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.GATEWAY_TIMEOUT));
    }

    @Test
    void defaultsToCurrentMonth() {
        when(dashboard.get(YearMonth.of(2026, 10))).thenReturn(dashboard("100.00", "50.00"));
        when(ai.analyze(any())).thenReturn(new AiAnalysis("s", List.of()));

        assertThat(service.generate(null).month()).isEqualTo(YearMonth.of(2026, 10));
    }

    private static DashboardResponse dashboard(String income, String expenses) {
        BigDecimal inc = new BigDecimal(income);
        BigDecimal exp = new BigDecimal(expenses);
        BudgetResponse budget = new BudgetResponse("b1", "c1", "Alimente", MONTH, new BigDecimal("1000"),
                new BigDecimal("700"), new BigDecimal("300"), new BigDecimal("70.00"), BudgetStatus.NORMAL);
        return new DashboardResponse(MONTH, inc, exp, inc.subtract(exp),
                new BigDecimal("25.00"), new BigDecimal("70.00"), List.of(), List.of(),
                List.of(new DashboardResponse.MonthlyTrendPoint(MONTH, inc, exp)), List.of(budget), List.of(), List.of());
    }
}
