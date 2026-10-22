package com.smartbudget.category;

import com.smartbudget.transaction.TransactionType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

/** Every user owns their categories; names are unique per user and transaction type. */
@Document(collection = "categories")
@CompoundIndex(name = "uk_category_user_name_type", def = "{'userId': 1, 'name': 1, 'type': 1}", unique = true)
public class Category {

    @Id
    private String id;
    private String userId;
    private String name;
    private TransactionType type;
    private String color;
    private String icon;

    public Category() {
    }

    public Category(String id, String name, TransactionType type, String color, String icon) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.color = color;
        this.icon = icon;
    }

    public Category(String id, String userId, String name, TransactionType type, String color, String icon) {
        this(id, name, type, color, icon);
        this.userId = userId;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public TransactionType getType() {
        return type;
    }

    public void setType(TransactionType type) {
        this.type = type;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public String getIcon() {
        return icon;
    }

    public void setIcon(String icon) {
        this.icon = icon;
    }
}
