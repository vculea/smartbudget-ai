package com.smartbudget.dashboard;

import com.smartbudget.budget.BudgetResponse;
import com.smartbudget.common.Money;
import java.math.BigDecimal;
import java.util.List;

/** Dashboard formulas; pure functions, no I/O. */
public final class DashboardCalculator {

    private DashboardCalculator() {
    }

    /** balance = totalIncome - totalExpenses */
    public static BigDecimal balance(BigDecimal income, BigDecimal expenses) {
        return income.subtract(expenses);
    }

    /** savingsRate = balance / totalIncome * 100 when income is positive; otherwise 0. */
    public static BigDecimal savingsRate(BigDecimal income, BigDecimal expenses) {
        if (income.signum() <= 0) {
            return Money.scale(BigDecimal.ZERO);
        }
        return Money.percentage(balance(income, expenses), income);
    }

    /**
     * budgetUsedPercentage = spending of categories that have a budget / sum of their limits * 100.
     * Categories without a budget are ignored; 0 when there are no budgets.
     */
    public static BigDecimal budgetUsedPercentage(List<BudgetResponse> budgets) {
        BigDecimal totalLimit = budgets.stream().map(BudgetResponse::limitAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalSpent = budgets.stream().map(BudgetResponse::spentAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return Money.percentage(totalSpent, totalLimit);
    }
}
