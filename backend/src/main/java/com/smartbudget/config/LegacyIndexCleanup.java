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
 * Before user accounts, a budget was unique per (month, category) across the whole database. That index would stop
 * two users from having a budget for the same category and month, so it is dropped (the per-user index replaces it).
 */
@Component
@Order(0)
public class LegacyIndexCleanup implements ApplicationRunner {

    static final String LEGACY_BUDGET_INDEX = "uk_budget_month_category";

    private static final Logger log = LoggerFactory.getLogger(LegacyIndexCleanup.class);

    private final MongoTemplate mongoTemplate;

    public LegacyIndexCleanup(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        var indexes = mongoTemplate.indexOps("budgets");
        if (indexes.getIndexInfo().stream().map(IndexInfo::getName).anyMatch(LEGACY_BUDGET_INDEX::equals)) {
            indexes.dropIndex(LEGACY_BUDGET_INDEX);
            log.info("Dropped legacy index {} on budgets", LEGACY_BUDGET_INDEX);
        }
    }
}
