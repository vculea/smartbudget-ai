package com.smartbudget.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ImportCategorizeRequest(
        @NotEmpty(message = "Lista de tranzacții nu poate fi goală")
        @Size(max = ImportAiLimits.MAX_ITEMS, message = "Prea multe tranzacții într-o cerere")
        List<@Valid ImportItem> items) {
}
