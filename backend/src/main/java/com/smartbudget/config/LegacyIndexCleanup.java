package com.smartbudget.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.stereotype.Component;

/**
 * Drops unique indexes from before user accounts, which would stop two users from having the same data:
 * a budget per (month, category) and a category per (name, type) across the whole database (the per-user indexes
 * replace them). Runs before {@link CategoryOwnershipMigration}, which needs the old category index gone.
 */
@Component
@Order(0)
public class LegacyIndexCleanup implements ApplicationRunner {

    static final String LEGACY_BUDGET_INDEX = "uk_budget_month_category";
    static final String LEGACY_CATEGORY_INDEX = "uk_category_name_type";

    private static final Logger log = LoggerFactory.getLogger(LegacyIndexCleanup.class);

    private final MongoTemplate mongoTemplate;

    public LegacyIndexCleanup(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        drop("budgets", LEGACY_BUDGET_INDEX);
        drop("categories", LEGACY_CATEGORY_INDEX);
    }

    private void drop(String collection, String index) {
        var indexes = mongoTemplate.indexOps(collection);
        if (indexes.getIndexInfo().stream().map(IndexInfo::getName).anyMatch(index::equals)) {
            indexes.dropIndex(index);
            log.info("Dropped legacy index {} on {}", index, collection);
        }
    }
}
