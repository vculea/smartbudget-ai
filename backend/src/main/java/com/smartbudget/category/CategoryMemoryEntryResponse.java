package com.smartbudget.category;

import com.smartbudget.transaction.TransactionType;
import java.time.Instant;

/**
 * A merchant the app remembers: the category used most for it and how many transactions taught it.
 * {@code certain} is false when the user splits the merchant between categories, so imports do not fill it in.
 */
public record CategoryMemoryEntryResponse(TransactionType type, String key, String categoryId, int hits,
                                          boolean certain, Instant updatedAt) {
}
