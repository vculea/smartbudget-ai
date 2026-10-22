package com.smartbudget.budget;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.YearMonth;

public record BudgetRequest(
        @NotBlank(message = "Categoria este obligatorie") String categoryId,
        @NotNull(message = "Luna este obligatorie (format YYYY-MM)") YearMonth month,
        @NotNull(message = "Limita este obligatorie")
        @DecimalMin(value = "0.01", message = "Limita trebuie să fie pozitivă")
        @DecimalMax(value = "1000000000", message = "Limita depășește valoarea permisă")
        @Digits(integer = 10, fraction = 2, message = "Limita poate avea cel mult 2 zecimale")
        BigDecimal limitAmount) {
}
