package com.smartbudget.transaction;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record TransactionRequest(
        @NotNull(message = "Tipul este obligatoriu") TransactionType type,
        @NotNull(message = "Suma este obligatorie")
        @DecimalMin(value = "0.01", message = "Suma trebuie să fie pozitivă")
        @DecimalMax(value = "1000000000", message = "Suma depășește limita permisă")
        @Digits(integer = 10, fraction = 2, message = "Suma poate avea cel mult 2 zecimale")
        BigDecimal amount,
        @NotBlank(message = "Descrierea este obligatorie")
        @Size(max = 200, message = "Descrierea poate avea cel mult 200 de caractere")
        String description,
        @NotNull(message = "Data este obligatorie") LocalDate transactionDate,
        @NotBlank(message = "Categoria este obligatorie") String categoryId) {
}
