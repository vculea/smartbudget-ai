package com.smartbudget.category;

import com.smartbudget.transaction.TransactionType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Descriptions of imported transactions whose category may be remembered from the user's earlier choices. */
public record CategoryMemoryMatchRequest(
        @NotEmpty(message = "Lista de tranzacții nu poate fi goală")
        @Size(max = CategoryMemoryMatchRequest.MAX_ITEMS, message = "Prea multe tranzacții într-o cerere")
        List<@Valid Item> items) {

    public static final int MAX_ITEMS = 1000;
    static final int MAX_DESCRIPTION = 200;

    public record Item(
            @Min(0) int index,
            @NotBlank(message = "Descrierea este obligatorie")
            @Size(max = MAX_DESCRIPTION, message = "Descriere prea lungă") String description,
            @NotNull(message = "Tipul este obligatoriu") TransactionType type) {
    }
}
