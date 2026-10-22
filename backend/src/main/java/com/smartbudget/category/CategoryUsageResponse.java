package com.smartbudget.category;

/** How many of the user's transactions and budgets reference a category. */
public record CategoryUsageResponse(long transactions, long budgets) {

    public boolean inUse() {
        return transactions > 0 || budgets > 0;
    }
}
