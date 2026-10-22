package com.smartbudget.category;

import com.smartbudget.transaction.TransactionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CategoryRequest(
        @NotBlank(message = "Numele este obligatoriu")
        @Size(max = 50, message = "Numele poate avea cel mult 50 de caractere")
        String name,
        @NotNull(message = "Tipul este obligatoriu")
        TransactionType type,
        /** Optional hex color, e.g. #4f46e5. */
        @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "Culoarea trebuie să fie de forma #RRGGBB")
        String color,
        @Size(max = 40, message = "Iconița poate avea cel mult 40 de caractere")
        String icon) {
}
