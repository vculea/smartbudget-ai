package com.smartbudget.transaction;

import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;

/** Optional query filters for GET /transactions (bound from query parameters). */
public record TransactionFilter(
        TransactionType type,
        String categoryId,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
        String search) {
}
