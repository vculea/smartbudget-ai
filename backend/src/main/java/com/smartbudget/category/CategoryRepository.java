package com.smartbudget.category;

import com.smartbudget.transaction.TransactionType;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface CategoryRepository extends MongoRepository<Category, String> {

    boolean existsByNameAndType(String name, TransactionType type);
}
