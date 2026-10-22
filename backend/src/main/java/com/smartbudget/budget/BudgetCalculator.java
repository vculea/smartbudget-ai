package com.smartbudget.budget;

import java.math.BigDecimal;

/** Budget status rules, computed on exact decimals (no rounding before comparing). */
public final class BudgetCalculator {

    public static final BigDecimal WARNING_RATIO = new BigDecimal("0.80");

    private BudgetCalculator() {
    }

    /** EXCEEDED when spent is above the limit; WARNING from 80% up to and including 100%; otherwise NORMAL. */
    public static BudgetStatus status(BigDecimal spent, BigDecimal limit) {
        if (spent.compareTo(limit) > 0) {
            return BudgetStatus.EXCEEDED;
        }
        if (spent.compareTo(limit.multiply(WARNING_RATIO)) >= 0) {
            return BudgetStatus.WARNING;
        }
        return BudgetStatus.NORMAL;
    }
}
