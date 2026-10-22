package com.smartbudget.transaction;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record BulkTransactionRequest(
        @NotEmpty(message = "Lista de tranzacții nu poate fi goală")
        @Size(max = BulkTransactionRequest.MAX_ITEMS, message = "Poți importa cel mult 1000 de tranzacții odată")
        List<@Valid TransactionRequest> transactions) {

    public static final int MAX_ITEMS = 1000;
}
