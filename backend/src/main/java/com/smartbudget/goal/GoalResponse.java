package com.smartbudget.goal;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record GoalResponse(
        String id,
        String name,
        String description,
        BigDecimal targetAmount,
        /** Sum of the goal's contributions (derived, never stored). */
        BigDecimal currentAmount,
        LocalDate targetDate,
        GoalStatus status,
        /** currentAmount / targetAmount * 100, capped at 100. */
        BigDecimal progressPercentage,
        Instant createdAt,
        Instant updatedAt) {
}
