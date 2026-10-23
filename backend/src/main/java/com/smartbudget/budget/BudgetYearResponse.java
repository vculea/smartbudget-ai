package com.smartbudget.budget;

/** {@code skipped}: category-month pairs that already had a budget and were left unchanged. */
public record BudgetYearResponse(int created, int skipped) {
}
