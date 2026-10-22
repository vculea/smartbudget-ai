package com.smartbudget.ai;

import java.time.YearMonth;

/** Only the month is accepted: financial figures are always recomputed from the database. */
public record AiInsightsRequest(YearMonth month) {
}
