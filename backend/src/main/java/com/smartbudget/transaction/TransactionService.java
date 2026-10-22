package com.smartbudget.transaction;

import com.smartbudget.auth.CurrentUser;
import com.smartbudget.category.Category;
import com.smartbudget.category.CategoryService;
import com.smartbudget.common.ApiException;
import com.smartbudget.common.Money;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.support.PageableExecutionUtils;
import org.springframework.stereotype.Service;

@Service
public class TransactionService {

    static final Set<String> SORTABLE_FIELDS = Set.of("transactionDate", "amount", "createdAt");
    static final int MAX_SEARCH_LENGTH = 100;

    private final TransactionRepository repository;
    private final CategoryService categoryService;
    private final MongoTemplate mongoTemplate;
    private final Clock clock;
    private final CurrentUser currentUser;

    public TransactionService(TransactionRepository repository, CategoryService categoryService,
                              MongoTemplate mongoTemplate, Clock clock, CurrentUser currentUser) {
        this.repository = repository;
        this.categoryService = categoryService;
        this.mongoTemplate = mongoTemplate;
        this.clock = clock;
        this.currentUser = currentUser;
    }

    public Page<TransactionResponse> list(TransactionFilter filter, Pageable pageable) {
        if (filter.startDate() != null && filter.endDate() != null && filter.startDate().isAfter(filter.endDate())) {
            throw ApiException.badRequest("Data de început nu poate fi după data de sfârșit.");
        }
        Pageable safePageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                sanitizeSort(pageable.getSort()));

        Query query = new Query(buildCriteria(filter));
        List<Transaction> content = mongoTemplate.find(Query.of(query).with(safePageable), Transaction.class);
        Page<Transaction> page = PageableExecutionUtils.getPage(content, safePageable,
                () -> mongoTemplate.count(Query.of(query).limit(-1).skip(-1), Transaction.class));

        Map<String, Category> categories = categoryService.getByIds(
                content.stream().map(Transaction::getCategoryId).distinct().toList());
        return page.map(tx -> toResponse(tx, categories.get(tx.getCategoryId())));
    }

    public List<TransactionResponse> recent(LocalDate from, LocalDate to, int limit) {
        Query query = new Query(Criteria.where("userId").is(currentUser.id()).and("transactionDate").gte(from).lte(to))
                .with(Sort.by(Sort.Order.desc("transactionDate"), Sort.Order.desc("createdAt")))
                .limit(limit);
        List<Transaction> content = mongoTemplate.find(query, Transaction.class);
        Map<String, Category> categories = categoryService.getByIds(
                content.stream().map(Transaction::getCategoryId).distinct().toList());
        return content.stream().map(tx -> toResponse(tx, categories.get(tx.getCategoryId()))).toList();
    }

    public TransactionResponse get(String id) {
        Transaction tx = find(id);
        return toResponse(tx, categoryService.getByIds(List.of(tx.getCategoryId())).get(tx.getCategoryId()));
    }

    public TransactionResponse create(TransactionRequest request) {
        Category category = validatedCategory(request);
        Transaction tx = new Transaction();
        tx.setUserId(currentUser.id());
        Instant now = clock.instant();
        tx.setCreatedAt(now);
        apply(tx, request, now);
        return toResponse(repository.save(tx), category);
    }

    public TransactionResponse update(String id, TransactionRequest request) {
        Transaction tx = find(id);
        Category category = validatedCategory(request);
        apply(tx, request, clock.instant());
        return toResponse(repository.save(tx), category);
    }

    public void delete(String id) {
        if (repository.deleteByIdAndUserId(id, currentUser.id()) == 0) {
            throw ApiException.notFound("Tranzacția nu există.");
        }
    }

    private Transaction find(String id) {
        return repository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> ApiException.notFound("Tranzacția nu există."));
    }

    private Category validatedCategory(TransactionRequest request) {
        Category category = categoryService.getById(request.categoryId());
        if (category.getType() != request.type()) {
            throw ApiException.unprocessable("Tipul tranzacției (" + request.type()
                    + ") nu corespunde tipului categoriei (" + category.getType() + ").");
        }
        return category;
    }

    private void apply(Transaction tx, TransactionRequest request, Instant now) {
        tx.setType(request.type());
        tx.setAmount(Money.scale(request.amount()));
        tx.setDescription(request.description().trim());
        tx.setTransactionDate(request.transactionDate());
        tx.setCategoryId(request.categoryId());
        tx.setUpdatedAt(now);
    }

    private TransactionResponse toResponse(Transaction tx, Category category) {
        return TransactionResponse.from(tx, category == null ? null : category.getName());
    }

    private Criteria buildCriteria(TransactionFilter filter) {
        List<Criteria> parts = new ArrayList<>();
        parts.add(Criteria.where("userId").is(currentUser.id()));
        if (filter.type() != null) {
            parts.add(Criteria.where("type").is(filter.type()));
        }
        if (filter.categoryId() != null && !filter.categoryId().isBlank()) {
            parts.add(Criteria.where("categoryId").is(filter.categoryId()));
        }
        if (filter.startDate() != null) {
            parts.add(Criteria.where("transactionDate").gte(filter.startDate()));
        }
        if (filter.endDate() != null) {
            parts.add(Criteria.where("transactionDate").lte(filter.endDate()));
        }
        if (filter.search() != null && !filter.search().isBlank()) {
            String term = filter.search().trim();
            if (term.length() > MAX_SEARCH_LENGTH) {
                throw ApiException.badRequest("Textul căutat poate avea cel mult " + MAX_SEARCH_LENGTH + " de caractere.");
            }
            parts.add(Criteria.where("description").regex(Pattern.compile(Pattern.quote(term), Pattern.CASE_INSENSITIVE)));
        }
        return new Criteria().andOperator(parts.toArray(Criteria[]::new));
    }

    private Sort sanitizeSort(Sort requested) {
        if (requested.isUnsorted()) {
            return Sort.by(Sort.Order.desc("transactionDate"), Sort.Order.desc("createdAt"));
        }
        List<Sort.Order> orders = new ArrayList<>();
        for (Sort.Order order : requested) {
            if (!SORTABLE_FIELDS.contains(order.getProperty())) {
                throw ApiException.badRequest("Sortarea după '" + order.getProperty() + "' nu este permisă. Câmpuri: "
                        + String.join(", ", SORTABLE_FIELDS.stream().sorted().toList()) + ".");
            }
            orders.add(new Sort.Order(order.getDirection(), order.getProperty()));
        }
        orders.add(Sort.Order.desc("createdAt"));
        return Sort.by(orders);
    }
}
