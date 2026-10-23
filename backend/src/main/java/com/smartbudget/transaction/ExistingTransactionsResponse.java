package com.smartbudget.transaction;

import java.util.List;

/** The {@code index} of every import row that is already saved. */
public record ExistingTransactionsResponse(List<Integer> indexes) {
}
