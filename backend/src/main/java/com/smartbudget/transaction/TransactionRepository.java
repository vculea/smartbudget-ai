package com.smartbudget.transaction;

import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface TransactionRepository extends MongoRepository<Transaction, String> {

    boolean existsByCategoryId(String categoryId);

    Optional<Transaction> findByIdAndUserId(String id, String userId);

    long deleteByIdAndUserId(String id, String userId);
}
