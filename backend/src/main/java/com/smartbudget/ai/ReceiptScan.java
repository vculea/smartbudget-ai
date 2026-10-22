package com.smartbudget.ai;

import com.smartbudget.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Transaction fields proposed from a receipt/payment photo. Everything is a suggestion that the user reviews:
 * {@code amount} and {@code categoryId} may be null when the model was not sure.
 */
public record ReceiptScan(
        TransactionType type,
        BigDecimal amount,
        String description,
        LocalDate transactionDate,
        String categoryId) {
}
