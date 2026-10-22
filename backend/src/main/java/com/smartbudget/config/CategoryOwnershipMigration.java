package com.smartbudget.config;

import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

import com.smartbudget.auth.User;
import com.smartbudget.budget.Budget;
import com.smartbudget.category.Category;
import com.smartbudget.category.CategoryRepository;
import com.smartbudget.transaction.Transaction;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

/**
 * Categories used to be shared by all users (documents without userId). Every known user (from users, transactions
 * and budgets) gets an own copy of each shared category, their transactions and budgets are pointed at the copies,
 * and the shared categories are then removed. Idempotent: copies are matched by name and type, and once the shared
 * categories are gone the migration does nothing.
 */
@Component
@Order(1)
public class CategoryOwnershipMigration implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CategoryOwnershipMigration.class);

    private final MongoTemplate mongoTemplate;
    private final CategoryRepository categories;

    public CategoryOwnershipMigration(MongoTemplate mongoTemplate, CategoryRepository categories) {
        this.mongoTemplate = mongoTemplate;
        this.categories = categories;
    }

    @Override
    public void run(ApplicationArguments args) {
        Query sharedQuery = query(where("userId").is(null));
        List<Category> shared = mongoTemplate.find(sharedQuery, Category.class);
        if (shared.isEmpty()) {
            return;
        }
        Set<String> userIds = knownUserIds();
        for (String userId : userIds) {
            for (Category category : shared) {
                String ownId = categories.findByUserIdAndNameAndType(userId, category.getName(), category.getType())
                        .orElseGet(() -> categories.save(new Category(null, userId, category.getName(),
                                category.getType(), category.getColor(), category.getIcon())))
                        .getId();
                Query uses = query(where("userId").is(userId).and("categoryId").is(category.getId()));
                Update pointToCopy = Update.update("categoryId", ownId);
                mongoTemplate.updateMulti(uses, pointToCopy, Transaction.class);
                mongoTemplate.updateMulti(uses, pointToCopy, Budget.class);
            }
        }
        mongoTemplate.remove(sharedQuery, Category.class);
        log.info("Gave {} users their own copy of {} shared categories", userIds.size(), shared.size());
    }

    private Set<String> knownUserIds() {
        Set<String> ids = new HashSet<>();
        mongoTemplate.findAll(User.class).forEach(user -> ids.add(user.getId()));
        ids.addAll(mongoTemplate.findDistinct(new Query(), "userId", Transaction.class, String.class));
        ids.addAll(mongoTemplate.findDistinct(new Query(), "userId", Budget.class, String.class));
        ids.removeIf(id -> id == null || id.isBlank());
        return ids;
    }
}
