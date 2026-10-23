package com.smartbudget.ai;

import jakarta.validation.constraints.NotNull;

/** Only the year is accepted: the figures are always recomputed from the database. */
public record BudgetPlanRequest(@NotNull(message = "Anul este obligatoriu") Integer year) {
}
