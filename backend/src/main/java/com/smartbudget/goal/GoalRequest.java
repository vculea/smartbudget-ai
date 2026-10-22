package com.smartbudget.goal;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record GoalRequest(
        @NotBlank(message = "Numele este obligatoriu")
        @Size(max = 100, message = "Numele poate avea cel mult 100 de caractere")
        String name,
        @Size(max = 500, message = "Descrierea poate avea cel mult 500 de caractere")
        String description,
        @NotNull(message = "Suma țintă este obligatorie")
        @DecimalMin(value = "0.01", message = "Suma țintă trebuie să fie pozitivă")
        @DecimalMax(value = "1000000000", message = "Suma țintă depășește limita permisă")
        @Digits(integer = 10, fraction = 2, message = "Suma țintă poate avea cel mult 2 zecimale")
        BigDecimal targetAmount,
        /** Optional; when present it must not be in the past. */
        LocalDate targetDate) {
}
