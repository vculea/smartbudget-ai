package com.smartbudget.ai;

import com.smartbudget.transaction.TransactionType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** One transaction of the import whose category must be suggested. {@code index} identifies it for the caller. */
public record ImportItem(
        @Min(0) int index,
        @NotBlank(message = "Descrierea este obligatorie")
        @Size(max = ImportAiLimits.MAX_CELL, message = "Descriere prea lungă") String description,
        @NotNull(message = "Tipul este obligatoriu") TransactionType type) {
}
