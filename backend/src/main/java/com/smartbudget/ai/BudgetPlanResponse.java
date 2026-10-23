package com.smartbudget.ai;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Monthly amounts proposed by the AI for a year; nothing is saved until the user confirms them.
 * {@code budgets}: spending limits of expense categories; {@code incomes}: expected income of income categories.
 * {@code basedOnYears}: the past years whose complete months were used.
 */
public record BudgetPlanResponse(int year, List<Integer> basedOnYears, String summary, List<Item> budgets,
                                 List<Item> incomes, Instant generatedAt) {

    public record Item(String categoryId, String categoryName, BigDecimal monthlyAmount, String reason,
                       List<YearAverage> history) {
    }

    /** Average monthly amount of the category in a past year. */
    public record YearAverage(int year, BigDecimal monthlyAverage) {
    }
}
