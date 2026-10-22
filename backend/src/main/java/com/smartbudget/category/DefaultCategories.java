package com.smartbudget.category;

import com.smartbudget.transaction.TransactionType;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Component;

/** The starter categories every new user receives; afterwards the user is free to edit or delete them. */
@Component
public class DefaultCategories {

    /** {@code key} identifies a template in code (demo data); it is not stored. */
    public record Template(String key, String name, TransactionType type, String color, String icon) {
    }

    public static final List<Template> TEMPLATES = List.of(
            new Template("salary", "Salariu", TransactionType.INCOME, "#10b981", "briefcase"),
            new Template("freelance", "Freelance", TransactionType.INCOME, "#14b8a6", "laptop"),
            new Template("bonus", "Bonusuri", TransactionType.INCOME, "#84cc16", "gift"),
            new Template("groceries", "Alimente", TransactionType.EXPENSE, "#4f46e5", "shopping-cart"),
            new Template("transport", "Transport", TransactionType.EXPENSE, "#0ea5e9", "car"),
            new Template("rent", "Chirie", TransactionType.EXPENSE, "#7c3aed", "home"),
            new Template("utilities", "Utilități", TransactionType.EXPENSE, "#f59e0b", "zap"),
            new Template("entertainment", "Divertisment", TransactionType.EXPENSE, "#ec4899", "film"),
            new Template("restaurants", "Restaurante", TransactionType.EXPENSE, "#f97316", "utensils"),
            new Template("health", "Sănătate", TransactionType.EXPENSE, "#ef4444", "heart-pulse"),
            new Template("shopping", "Cumpărături", TransactionType.EXPENSE, "#a855f7", "shopping-bag"));

    private final CategoryRepository repository;

    public DefaultCategories(CategoryRepository repository) {
        this.repository = repository;
    }

    /**
     * Gives a user the starter set when they have no categories at all. A user who already has categories keeps
     * them as they are (deleted defaults are not brought back).
     */
    public int createIfNone(String userId) {
        if (repository.existsByUserId(userId)) {
            return 0;
        }
        return ensure(userId).size();
    }

    /**
     * Makes sure the user has every starter category (matched by name and type) and returns template key -> id.
     * Used by the demo data, which needs to know the ids.
     */
    public Map<String, String> ensure(String userId) {
        Map<String, String> ids = new LinkedHashMap<>();
        for (Template t : TEMPLATES) {
            Category category = repository.findByUserIdAndNameAndType(userId, t.name(), t.type())
                    .orElseGet(() -> save(new Category(null, userId, t.name(), t.type(), t.color(), t.icon())));
            ids.put(t.key(), category.getId());
        }
        return ids;
    }

    private Category save(Category category) {
        try {
            return repository.save(category);
        } catch (DuplicateKeyException ex) {
            // created concurrently (e.g. two first logins at once)
            return repository.findByUserIdAndNameAndType(category.getUserId(), category.getName(), category.getType())
                    .orElseThrow(() -> ex);
        }
    }
}
