package com.smartbudget.budget;

import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface BudgetRepository extends MongoRepository<Budget, String> {

    List<Budget> findByMonth(String month);

    /** Budgets of every month of a year, e.g. prefix {@code "2026-"}. */
    List<Budget> findByMonthStartingWith(String prefix);

    boolean existsByCategoryIdAndMonth(String categoryId, String month);
}
