package com.smartbudget.goal;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface SavingsGoalRepository extends MongoRepository<SavingsGoal, String> {
}
