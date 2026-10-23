package com.smartbudget.category;

import com.smartbudget.transaction.TransactionType;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * How many times the user put transactions of a merchant ({@link MerchantKey}) in a category. One document per
 * (user, type, key, category), so a merchant used with several categories keeps a count for each.
 */
@Document(collection = "category_memory")
@CompoundIndexes({
        @CompoundIndex(name = "uk_memory_user_type_key_category",
                def = "{'userId': 1, 'type': 1, 'key': 1, 'categoryId': 1}", unique = true),
        @CompoundIndex(name = "idx_memory_user_token", def = "{'userId': 1, 'token': 1}"),
        @CompoundIndex(name = "idx_memory_user_updated", def = "{'userId': 1, 'updatedAt': -1}")
})
public class CategoryMemoryVote {

    @Id
    private String id;
    private String userId;
    private TransactionType type;
    private String key;
    /** First word of {@link #key}, to find keys of the same merchant written differently. */
    private String token;
    private String categoryId;
    private int hits;
    private Instant updatedAt;

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

    public TransactionType getType() {
        return type;
    }

    public void setType(TransactionType type) {
        this.type = type;
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }

    public int getHits() {
        return hits;
    }

    public void setHits(int hits) {
        this.hits = hits;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
