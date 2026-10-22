package com.smartbudget.ai;

import java.time.YearMonth;

/**
 * Only the period is accepted (either a month or a whole year): financial figures are always recomputed
 * from the database.
 */
public record AiInsightsRequest(YearMonth month, Integer year) {
}
