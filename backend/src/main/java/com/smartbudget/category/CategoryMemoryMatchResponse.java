package com.smartbudget.category;

import java.util.List;

/** {@code categoryId} is null when the user has no clear earlier choice for the merchant. */
public record CategoryMemoryMatchResponse(List<Suggestion> suggestions) {

    public record Suggestion(int index, String categoryId) {
    }
}
