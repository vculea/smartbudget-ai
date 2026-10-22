package com.smartbudget.category;

import com.smartbudget.transaction.TransactionType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface CategoryRepository extends MongoRepository<Category, String> {

    List<Category> findByUserId(String userId, Sort sort);

    Optional<Category> findByIdAndUserId(String id, String userId);

    List<Category> findByIdInAndUserId(Iterable<String> ids, String userId);

    Optional<Category> findByUserIdAndNameAndType(String userId, String name, TransactionType type);

    boolean existsByUserId(String userId);

    long countByUserId(String userId);
}
