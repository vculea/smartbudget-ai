package com.smartbudget.dashboard;

import com.smartbudget.budget.BudgetResponse;
import com.smartbudget.budget.BudgetService;
import com.smartbudget.category.Category;
import com.smartbudget.category.CategoryService;
import com.smartbudget.common.Money;
import com.smartbudget.dashboard.DashboardResponse.CategoryExpense;
import com.smartbudget.dashboard.DashboardResponse.MonthlyTrendPoint;
import com.smartbudget.goal.GoalService;
import com.smartbudget.transaction.TransactionService;
import com.smartbudget.transaction.TransactionStatsService;
import com.smartbudget.transaction.TransactionStatsService.PeriodTotals;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class DashboardService {

    static final int TOP_CATEGORIES = 5;
    static final int TREND_MONTHS = 6;
    static final int MONTHS_IN_YEAR = 12;
    static final int RECENT_TRANSACTIONS = 5;

    private final TransactionStatsService statsService;
    private final TransactionService transactionService;
    private final BudgetService budgetService;
    private final GoalService goalService;
    private final CategoryService categoryService;

    public DashboardService(TransactionStatsService statsService, TransactionService transactionService,
                            BudgetService budgetService, GoalService goalService, CategoryService categoryService) {
        this.statsService = statsService;
        this.transactionService = transactionService;
        this.budgetService = budgetService;
        this.goalService = goalService;
        this.categoryService = categoryService;
    }

    public DashboardResponse get(YearMonth month) {
        LocalDate from = month.atDay(1);
        LocalDate to = month.atEndOfMonth();
        Map<String, BigDecimal> expensesByCategoryId = statsService.expensesByCategory(from, to);
        List<BudgetResponse> budgets = budgetService.list(month, expensesByCategoryId);
        return build(month.toString(), from, to, expensesByCategoryId, budgets, trend(month, TREND_MONTHS));
    }

    public DashboardResponse getForYear(int year) {
        LocalDate from = LocalDate.of(year, 1, 1);
        LocalDate to = LocalDate.of(year, 12, 31);
        Map<String, BigDecimal> expensesByCategoryId = statsService.expensesByCategory(from, to);
        List<BudgetResponse> budgets = budgetService.listForYear(year, expensesByCategoryId);
        return build(String.valueOf(year), from, to, expensesByCategoryId, budgets,
                trend(YearMonth.of(year, 12), MONTHS_IN_YEAR));
    }

    private DashboardResponse build(String period, LocalDate from, LocalDate to,
                                    Map<String, BigDecimal> expensesByCategoryId, List<BudgetResponse> budgets,
                                    List<MonthlyTrendPoint> trend) {
        PeriodTotals totals = statsService.totals(from, to);
        List<CategoryExpense> breakdown = categoryBreakdown(expensesByCategoryId, totals.expenses());

        return new DashboardResponse(
                period,
                Money.scale(totals.income()),
                Money.scale(totals.expenses()),
                Money.scale(DashboardCalculator.balance(totals.income(), totals.expenses())),
                DashboardCalculator.savingsRate(totals.income(), totals.expenses()),
                DashboardCalculator.budgetUsedPercentage(budgets),
                breakdown.stream().limit(TOP_CATEGORIES).toList(),
                breakdown,
                trend,
                budgets,
                goalService.list(),
                transactionService.recent(from, to, RECENT_TRANSACTIONS));
    }

    private List<CategoryExpense> categoryBreakdown(Map<String, BigDecimal> byCategoryId, BigDecimal totalExpenses) {
        Map<String, Category> categories = categoryService.getByIds(byCategoryId.keySet());
        return byCategoryId.entrySet().stream()
                .map(entry -> {
                    Category category = categories.get(entry.getKey());
                    return new CategoryExpense(entry.getKey(), category == null ? "?" : category.getName(),
                            Money.scale(entry.getValue()), Money.percentage(entry.getValue(), totalExpenses));
                })
                .sorted(Comparator.comparing(CategoryExpense::amount).reversed())
                .toList();
    }

    /** The {@code count} months ending with {@code last}. */
    private List<MonthlyTrendPoint> trend(YearMonth last, int count) {
        List<MonthlyTrendPoint> points = new ArrayList<>();
        for (int i = count - 1; i >= 0; i--) {
            YearMonth m = last.minusMonths(i);
            PeriodTotals totals = statsService.totals(m.atDay(1), m.atEndOfMonth());
            points.add(new MonthlyTrendPoint(m, Money.scale(totals.income()), Money.scale(totals.expenses())));
        }
        return points;
    }
}
