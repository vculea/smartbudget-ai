package com.smartbudget.transaction;

import com.smartbudget.common.Money;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record TransactionResponse(
        String id,
        TransactionType type,
        BigDecimal amount,
        String description,
        LocalDate transactionDate,
        String categoryId,
        String categoryName,
        Instant createdAt,
        Instant updatedAt) {

    public static TransactionResponse from(Transaction tx, String categoryName) {
        return new TransactionResponse(tx.getId(), tx.getType(), Money.scale(tx.getAmount()), tx.getDescription(),
                tx.getTransactionDate(), tx.getCategoryId(), categoryName, tx.getCreatedAt(), tx.getUpdatedAt());
    }
}
