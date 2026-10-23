package com.smartbudget.budget;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/** The same monthly limit per category, applied to the chosen months (1-12) of a year. */
public record BudgetYearRequest(
        @NotNull(message = "Anul este obligatoriu") Integer year,
        @NotEmpty(message = "Alege cel puțin o lună")
        @Size(max = 12, message = "Un an are cel mult 12 luni")
        List<@NotNull @Min(value = 1, message = "Luna trebuie să fie între 1 și 12")
                @Max(value = 12, message = "Luna trebuie să fie între 1 și 12") Integer> months,
        @NotEmpty(message = "Completează limita pentru cel puțin o categorie")
        @Size(max = 200, message = "Prea multe categorii")
        List<@Valid @NotNull Item> items) {

    public record Item(
            @NotBlank(message = "Categoria este obligatorie") String categoryId,
            @NotNull(message = "Limita este obligatorie")
            @DecimalMin(value = "0.01", message = "Limita trebuie să fie pozitivă")
            @DecimalMax(value = "1000000000", message = "Limita depășește valoarea permisă")
            @Digits(integer = 10, fraction = 2, message = "Limita poate avea cel mult 2 zecimale")
            BigDecimal limitAmount) {
    }
}
