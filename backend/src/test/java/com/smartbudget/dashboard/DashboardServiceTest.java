package com.smartbudget.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.smartbudget.budget.BudgetResponse;
import com.smartbudget.budget.BudgetService;
import com.smartbudget.budget.BudgetStatus;
import com.smartbudget.category.Category;
import com.smartbudget.category.CategoryService;
import com.smartbudget.goal.GoalService;
import com.smartbudget.transaction.TransactionService;
import com.smartbudget.transaction.TransactionStatsService;
import com.smartbudget.transaction.TransactionStatsService.PeriodTotals;
import com.smartbudget.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DashboardServiceTest {

    private static final YearMonth MONTH = YearMonth.of(2026, 9);

    private final TransactionStatsService stats = mock(TransactionStatsService.class);
    private final TransactionService transactions = mock(TransactionService.class);
    private final BudgetService budgets = mock(BudgetService.class);
    private final GoalService goals = mock(GoalService.class);
    private final CategoryService categories = mock(CategoryService.class);
    private DashboardService service;

    @BeforeEach
    void setUp() {
        service = new DashboardService(stats, transactions, budgets, goals, categories);
        when(goals.list()).thenReturn(List.of());
        when(transactions.recent(any(), any(), eq(5))).thenReturn(List.of());
        when(budgets.list(eq(MONTH), any())).thenReturn(List.of());
    }

    @Test
    void computesIncomeExpensesBalanceAndSavingsRate() {
        when(stats.totals(any(), any())).thenReturn(new PeriodTotals(new BigDecimal("6000"), new BigDecimal("4500")));
        when(stats.expensesByCategory(any(), any())).thenReturn(Map.of("c1", new BigDecimal("3000"), "c2", new BigDecimal("1500")));
        when(categories.getByIds(any())).thenReturn(Map.of(
                "c1", new Category("c1", "Chirie", TransactionType.EXPENSE, null, null),
                "c2", new Category("c2", "Alimente", TransactionType.EXPENSE, null, null)));

        DashboardResponse response = service.get(MONTH);

        assertThat(response.totalIncome()).isEqualByComparingTo("6000.00");
        assertThat(response.totalExpenses()).isEqualByComparingTo("4500.00");
        assertThat(response.balance()).isEqualByComparingTo("1500.00");
        assertThat(response.savingsRate()).isEqualByComparingTo("25.00");
        assertThat(response.topCategories()).extracting(DashboardResponse.CategoryExpense::categoryName)
                .containsExactly("Chirie", "Alimente");
        assertThat(response.topCategories().get(0).percentage()).isEqualByComparingTo("66.67");
        assertThat(response.monthlyTrend()).hasSize(6);
        assertThat(response.monthlyTrend().get(5).month()).isEqualTo(MONTH);
    }

    @Test
    void savingsRateIsZeroWhenIncomeIsZero() {
        when(stats.totals(any(), any())).thenReturn(new PeriodTotals(BigDecimal.ZERO, new BigDecimal("800")));
        when(stats.expensesByCategory(any(), any())).thenReturn(Map.of());
        when(categories.getByIds(any())).thenReturn(Map.of());

        DashboardResponse response = service.get(MONTH);

        assertThat(response.balance()).isEqualByComparingTo("-800.00");
        assertThat(response.savingsRate()).isEqualByComparingTo("0");
    }

    @Test
    void emptyMonthReturnsZeros() {
        when(stats.totals(any(), any())).thenReturn(new PeriodTotals(BigDecimal.ZERO, BigDecimal.ZERO));
        when(stats.expensesByCategory(any(), any())).thenReturn(Map.of());
        when(categories.getByIds(any())).thenReturn(Map.of());

        DashboardResponse response = service.get(MONTH);

        assertThat(response.balance()).isEqualByComparingTo("0");
        assertThat(response.savingsRate()).isEqualByComparingTo("0");
        assertThat(response.budgetUsedPercentage()).isEqualByComparingTo("0");
        assertThat(response.topCategories()).isEmpty();
    }

    @Test
    void negativeSavingsRateWhenSpendingExceedsIncome() {
        assertThat(DashboardCalculator.savingsRate(new BigDecimal("1000"), new BigDecimal("1250")))
                .isEqualByComparingTo("-25.00");
    }

    @Test
    void budgetUsedPercentageOnlyCountsBudgetedCategories() {
        // Total spending is 4500, but only 1050 was spent on the two budgeted categories (limits 1500)
        when(stats.totals(any(), any())).thenReturn(new PeriodTotals(new BigDecimal("6000"), new BigDecimal("4500")));
        when(stats.expensesByCategory(any(), any())).thenReturn(Map.of());
        when(categories.getByIds(any())).thenReturn(Map.of());
        when(budgets.list(eq(MONTH), any())).thenReturn(List.of(
                budget("1000", "600"),
                budget("500", "450")));

        DashboardResponse response = service.get(MONTH);

        assertThat(response.budgetUsedPercentage()).isEqualByComparingTo("70.00");
    }

    @Test
    void budgetUsedPercentageIsZeroWithoutBudgets() {
        assertThat(DashboardCalculator.budgetUsedPercentage(List.of())).isEqualByComparingTo("0");
    }

    private static BudgetResponse budget(String limit, String spent) {
        return new BudgetResponse("b", "c", "Cat", MONTH, new BigDecimal(limit), new BigDecimal(spent),
                new BigDecimal(limit).subtract(new BigDecimal(spent)), BigDecimal.ZERO, BudgetStatus.NORMAL);
    }
}
