package com.smartbudget.budget;

import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface BudgetRepository extends MongoRepository<Budget, String> {

    List<Budget> findByUserIdAndMonth(String userId, String month);

    /** Budgets of every month of a year, e.g. prefix {@code "2026-"}. */
    List<Budget> findByUserIdAndMonthStartingWith(String userId, String prefix);

    boolean existsByUserIdAndCategoryIdAndMonth(String userId, String categoryId, String month);
}
