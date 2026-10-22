package com.smartbudget.common;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Money and percentage helpers. All financial math uses BigDecimal; amounts have 2 decimals. */
public final class Money {

    public static final int SCALE = 2;
    public static final BigDecimal MAX_AMOUNT = new BigDecimal("1000000000");

    private Money() {
    }

    public static BigDecimal scale(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(SCALE, RoundingMode.HALF_UP);
    }

    /** part / total * 100 rounded to 2 decimals; 0 when total is not positive. */
    public static BigDecimal percentage(BigDecimal part, BigDecimal total) {
        if (part == null || total == null || total.signum() <= 0) {
            return scale(BigDecimal.ZERO);
        }
        return part.multiply(BigDecimal.valueOf(100)).divide(total, SCALE, RoundingMode.HALF_UP);
    }
}
