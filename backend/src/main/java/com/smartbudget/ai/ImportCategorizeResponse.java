package com.smartbudget.ai;

import java.util.List;

/** {@code categoryId} is null when the model was not sure; the user then picks the category. */
public record ImportCategorizeResponse(List<Suggestion> suggestions) {

    public record Suggestion(int index, String categoryId) {
    }
}
