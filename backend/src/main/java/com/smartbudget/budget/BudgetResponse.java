package com.smartbudget.budget;

import java.math.BigDecimal;

public record BudgetResponse(
        String id,
        String categoryId,
        String categoryName,
        /** YYYY-MM for a monthly budget or YYYY for budgets aggregated over a year. */
        String month,
        BigDecimal limitAmount,
        BigDecimal spentAmount,
        /** limit - spent; negative when the budget is exceeded. */
        BigDecimal remainingAmount,
        /** spent / limit * 100, can exceed 100. */
        BigDecimal percentageUsed,
        BudgetStatus status) {
}
