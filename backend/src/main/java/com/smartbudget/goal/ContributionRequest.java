package com.smartbudget.goal;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ContributionRequest(
        @NotNull(message = "Suma este obligatorie")
        @DecimalMin(value = "0.01", message = "Suma trebuie să fie pozitivă")
        @DecimalMax(value = "1000000000", message = "Suma depășește limita permisă")
        @Digits(integer = 10, fraction = 2, message = "Suma poate avea cel mult 2 zecimale")
        BigDecimal amount,
        /** Optional; defaults to today and cannot be in the future. */
        LocalDate contributionDate,
        @Size(max = 255, message = "Nota poate avea cel mult 255 de caractere")
        String note) {
}
