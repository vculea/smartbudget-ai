package com.smartbudget.config;

import com.smartbudget.category.Category;
import com.smartbudget.category.CategoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Categories are reference data the API cannot create, so an empty database would make the app unusable.
 * When none exist (even with demo seeding disabled) the default set is inserted; existing data is never touched.
 */
@Component
@Order(0)
public class DefaultCategoriesInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DefaultCategoriesInitializer.class);

    private final CategoryRepository categories;

    public DefaultCategoriesInitializer(CategoryRepository categories) {
        this.categories = categories;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (categories.count() > 0) {
            return;
        }
        categories.saveAll(DemoDataSeeder.defaultCategories());
        log.info("No categories found: inserted {} default categories", DemoDataSeeder.defaultCategories().size());
    }
}
