package com.smartbudget.category;

import com.smartbudget.transaction.TransactionType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** The categories the user kept when saving an import. */
public record CategoryMemoryLearnRequest(
        @NotEmpty(message = "Lista de tranzacții nu poate fi goală")
        @Size(max = CategoryMemoryLearnRequest.MAX_ENTRIES, message = "Prea multe tranzacții într-o cerere")
        List<@Valid Entry> entries) {

    public static final int MAX_ENTRIES = 1000;

    /**
     * {@code corrected}: the user replaced the suggested category, so this choice wins over what was remembered
     * for the merchant; otherwise it only adds to the count of the category.
     */
    public record Entry(
            @NotBlank(message = "Descrierea este obligatorie")
            @Size(max = CategoryMemoryMatchRequest.MAX_DESCRIPTION, message = "Descriere prea lungă")
            String description,
            @NotNull(message = "Tipul este obligatoriu") TransactionType type,
            @NotBlank(message = "Categoria este obligatorie") String categoryId,
            boolean corrected) {
    }
}
