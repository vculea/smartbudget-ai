package com.smartbudget.dashboard;

import com.smartbudget.budget.BudgetResponse;
import com.smartbudget.goal.GoalResponse;
import com.smartbudget.transaction.TransactionResponse;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;

public record DashboardResponse(
        YearMonth month,
        BigDecimal totalIncome,
        BigDecimal totalExpenses,
        /** totalIncome - totalExpenses. */
        BigDecimal balance,
        /** balance / totalIncome * 100, 0 when there is no income. */
        BigDecimal savingsRate,
        /** Spending on budgeted categories / total budget limits * 100, 0 when there are no budgets. */
        BigDecimal budgetUsedPercentage,
        /** Top 5 expense categories of the month. */
        List<CategoryExpense> topCategories,
        /** All expense categories of the month (for charts). */
        List<CategoryExpense> expensesByCategory,
        /** Income and expenses for the 6 months ending with the selected month. */
        List<MonthlyTrendPoint> monthlyTrend,
        List<BudgetResponse> budgets,
        List<GoalResponse> goals,
        List<TransactionResponse> recentTransactions) {

    public record CategoryExpense(String categoryId, String categoryName, BigDecimal amount, BigDecimal percentage) {
    }

    public record MonthlyTrendPoint(YearMonth month, BigDecimal income, BigDecimal expenses) {
    }
}
