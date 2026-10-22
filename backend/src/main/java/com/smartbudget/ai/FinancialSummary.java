package com.smartbudget.ai;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/**
 * Aggregated figures sent to the AI provider. Built exclusively from persisted data; contains no
 * transaction descriptions or any identifier of the user.
 */
public record FinancialSummary(
        String month,
        BigDecimal totalIncome,
        BigDecimal totalExpenses,
        BigDecimal balance,
        BigDecimal savingsRate,
        BigDecimal budgetUsedPercentage,
        List<CategorySpending> expensesByCategory,
        List<BudgetUsage> budgets,
        List<GoalProgress> goals,
        List<MonthTotals> previousMonths) {

    public record CategorySpending(String category, BigDecimal amount, BigDecimal percentageOfExpenses) {
    }

    public record BudgetUsage(String category, BigDecimal limit, BigDecimal spent, BigDecimal percentageUsed,
                              String status) {
    }

    public record GoalProgress(String name, BigDecimal targetAmount, BigDecimal currentAmount,
                               BigDecimal progressPercentage, LocalDate targetDate, String status) {
    }

    public record MonthTotals(YearMonth month, BigDecimal income, BigDecimal expenses) {
    }
}
