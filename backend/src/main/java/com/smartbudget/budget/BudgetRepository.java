package com.smartbudget.budget;

import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface BudgetRepository extends MongoRepository<Budget, String> {

    List<Budget> findByMonth(String month);

    boolean existsByCategoryIdAndMonth(String categoryId, String month);
}
