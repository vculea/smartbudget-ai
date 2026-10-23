package com.smartbudget.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartbudget.TestClock;
import com.smartbudget.category.CategoryResponse;
import com.smartbudget.category.CategoryService;
import com.smartbudget.common.ApiException;
import com.smartbudget.transaction.TransactionStatsService;
import com.smartbudget.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class BudgetPlanServiceTest {

    private final CategoryService categories = mock(CategoryService.class);
    private final TransactionStatsService stats = mock(TransactionStatsService.class);
    private BudgetPlanService service;

    @BeforeEach
    void setUp() {
        when(categories.list()).thenReturn(List.of(
                new CategoryResponse("food", "Alimente", TransactionType.EXPENSE, null, null),
                new CategoryResponse("fun", "Divertisment", TransactionType.EXPENSE, null, null),
                new CategoryResponse("car", "Mașină", TransactionType.EXPENSE, null, null),
                new CategoryResponse("salary", "Salariu", TransactionType.INCOME, null, null)));
        // Clock: 2026-10-22, so 2026 has 9 complete months; data starts in March 2025 (10 months).
        when(stats.firstTransactionDate()).thenReturn(Optional.of(LocalDate.of(2025, 3, 15)));
        LocalDate from2025 = LocalDate.of(2025, 3, 1);
        LocalDate to2025 = LocalDate.of(2025, 12, 31);
        LocalDate from2026 = LocalDate.of(2026, 1, 1);
        LocalDate to2026 = LocalDate.of(2026, 9, 30);
        when(stats.totals(from2025, to2025)).thenReturn(
                new TransactionStatsService.PeriodTotals(new BigDecimal("50000"), new BigDecimal("30000")));
        when(stats.expensesByCategory(from2025, to2025)).thenReturn(Map.of(
                "food", new BigDecimal("10000"), "fun", new BigDecimal("2000"), "deleted", new BigDecimal("500")));
        when(stats.totals(from2026, to2026)).thenReturn(
                new TransactionStatsService.PeriodTotals(new BigDecimal("54000"), new BigDecimal("27000")));
        when(stats.expensesByCategory(from2026, to2026)).thenReturn(Map.of("food", new BigDecimal("9900")));
        when(stats.incomesByCategory(from2025, to2025)).thenReturn(Map.of("salary", new BigDecimal("50000")));
        when(stats.incomesByCategory(from2026, to2026)).thenReturn(Map.of("salary", new BigDecimal("54000")));
        service = new BudgetPlanService(null, new AiProperties(null, null, null, null, null, null, null, null),
                new ObjectMapper(), categories, stats, TestClock.FIXED);
    }

    @Test
    void promptHasMonthlyAveragesOfCompleteMonthsForCategoriesWithAmounts() {
        ImportAiPrompt prompt = service.prompt(2027);

        assertThat(prompt.systemPrompt()).isEqualTo(BudgetPlanService.SYSTEM_PROMPT);
        assertThat(prompt.userMessage())
                .contains("\"year\":2027")
                .contains("\"year\":2025,\"completeMonths\":10,\"averageMonthlyIncome\":5000.00")
                .contains("\"year\":2026,\"completeMonths\":9,\"averageMonthlyIncome\":6000.00")
                .contains("{\"id\":1,\"name\":\"Alimente\",\"type\":\"EXPENSE\",\"averageMonthlyAmountByYear\":{\"2025\":1000.00,\"2026\":1100.00}}")
                .contains("{\"id\":2,\"name\":\"Divertisment\",\"type\":\"EXPENSE\",\"averageMonthlyAmountByYear\":{\"2025\":200.00,\"2026\":0.00}}")
                .contains("{\"id\":3,\"name\":\"Salariu\",\"type\":\"INCOME\",\"averageMonthlyAmountByYear\":{\"2025\":5000.00,\"2026\":6000.00}}")
                .doesNotContain("Mașină")
                .doesNotContain("deleted");
    }

    @Test
    void keepsValidLimitsAndDropsUnknownDuplicateOrInvalidOnes() {
        BudgetPlanResponse plan = service.result(2027, """
                ```json
                {"summary": "Plan prudent: 100 € economii.",
                 "budgets": [
                   {"category": 2, "monthlyLimit": "180,5", "reason": "Media a fost 200 lei."},
                   {"category": 1, "monthlyLimit": 1150, "reason": "Tendință în creștere."},
                   {"category": 1, "monthlyLimit": 9999},
                   {"category": 9, "monthlyLimit": 100},
                   {"category": 3, "monthlyLimit": 100},
                   {"category": 2, "monthlyLimit": -5}
                 ],
                 "incomes": [
                   {"category": 1, "monthlyAmount": 500},
                   {"category": 3, "monthlyAmount": 5800, "reason": "Salariul recent."}
                 ]}
                ```""");

        assertThat(plan.year()).isEqualTo(2027);
        assertThat(plan.basedOnYears()).containsExactly(2025, 2026);
        assertThat(plan.summary()).isEqualTo("Plan prudent: 100 lei economii.");
        assertThat(plan.budgets()).extracting(BudgetPlanResponse.Item::categoryId).containsExactly("food", "fun");
        BudgetPlanResponse.Item food = plan.budgets().get(0);
        assertThat(food.monthlyAmount()).isEqualByComparingTo("1150.00");
        assertThat(food.reason()).isEqualTo("Tendință în creștere.");
        assertThat(food.history()).extracting(BudgetPlanResponse.YearAverage::monthlyAverage)
                .usingElementComparator(BigDecimal::compareTo)
                .containsExactly(new BigDecimal("1000"), new BigDecimal("1100"));
        assertThat(plan.budgets().get(1).monthlyAmount()).isEqualByComparingTo("180.50");
        assertThat(plan.incomes()).singleElement().satisfies(salary -> {
            assertThat(salary.categoryId()).isEqualTo("salary");
            assertThat(salary.monthlyAmount()).isEqualByComparingTo("5800.00");
            assertThat(salary.history()).extracting(BudgetPlanResponse.YearAverage::monthlyAverage)
                    .usingElementComparator(BigDecimal::compareTo)
                    .containsExactly(new BigDecimal("5000"), new BigDecimal("6000"));
        });
    }

    @Test
    void rejectsAnAnswerWithoutValidLimits() {
        assertThatThrownBy(() -> service.result(2027, "{\"budgets\": [{\"category\": 7, \"monthlyLimit\": 10}]}"))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY));
        assertThatThrownBy(() -> service.result(2027, "not json"))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    void refusesWhenThereIsNoSpendingToBaseThePlanOn() {
        when(stats.firstTransactionDate()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.prompt(2027))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY));
    }

    @Test
    void serverAiRequiresAnApiKey() {
        assertThatThrownBy(() -> service.generate(2027))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }
}
