package com.smartbudget.ai;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/** The first rows of an uploaded CSV/Excel file; used to detect which column holds what. */
public record ImportColumnsRequest(
        @NotEmpty(message = "Rândurile sunt obligatorii")
        @Size(max = ImportAiLimits.MAX_SAMPLE_ROWS, message = "Prea multe rânduri")
        List<@Size(max = ImportAiLimits.MAX_COLUMNS, message = "Prea multe coloane")
             List<@Size(max = ImportAiLimits.MAX_CELL, message = "Celulă prea lungă") String>> rows) {
}
