package com.smartbudget.budget;

import java.math.BigDecimal;

/** Expected income of a category (a budget on an income category) compared with the income received. */
public record IncomePlanResponse(
        String id,
        String categoryId,
        String categoryName,
        /** YYYY-MM, or YYYY when the monthly amounts are summed over a year. */
        String month,
        BigDecimal expectedAmount,
        BigDecimal receivedAmount,
        /** expected - received, never negative. */
        BigDecimal remainingAmount,
        /** received / expected * 100, can exceed 100. */
        BigDecimal percentageReceived,
        IncomePlanStatus status) {
}
