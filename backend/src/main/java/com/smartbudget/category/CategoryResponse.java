package com.smartbudget.category;

import com.smartbudget.transaction.TransactionType;

public record CategoryResponse(String id, String name, TransactionType type, String color, String icon) {

    public static CategoryResponse from(Category category) {
        return new CategoryResponse(category.getId(), category.getName(), category.getType(),
                category.getColor(), category.getIcon());
    }
}
