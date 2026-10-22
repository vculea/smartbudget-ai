package com.smartbudget.budget;

import java.math.BigDecimal;
import java.time.YearMonth;

public record BudgetResponse(
        String id,
        String categoryId,
        String categoryName,
        YearMonth month,
        BigDecimal limitAmount,
        BigDecimal spentAmount,
        /** limit - spent; negative when the budget is exceeded. */
        BigDecimal remainingAmount,
        /** spent / limit * 100, can exceed 100. */
        BigDecimal percentageUsed,
        BudgetStatus status) {
}
