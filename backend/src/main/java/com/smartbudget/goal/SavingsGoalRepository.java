package com.smartbudget.goal;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface SavingsGoalRepository extends MongoRepository<SavingsGoal, String> {

    List<SavingsGoal> findByUserId(String userId, Sort sort);

    Optional<SavingsGoal> findByIdAndUserId(String id, String userId);
}
