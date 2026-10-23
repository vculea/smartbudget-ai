package com.smartbudget.transaction;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** The rows of an import file to compare with the transactions the user already has. */
public record ExistingTransactionsRequest(
        @NotEmpty(message = "Lista de tranzacții nu poate fi goală")
        @Size(max = BulkTransactionRequest.MAX_ITEMS, message = "Poți verifica cel mult 1000 de tranzacții odată")
        List<@Valid @NotNull Item> items) {

    public record Item(
            @NotNull Integer index,
            @NotNull TransactionType type,
            @NotNull BigDecimal amount,
            @NotBlank @Size(max = 200) String description,
            @NotNull LocalDate transactionDate) {
    }
}
