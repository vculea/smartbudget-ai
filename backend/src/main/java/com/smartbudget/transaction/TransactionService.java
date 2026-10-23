package com.smartbudget.transaction;

import com.smartbudget.auth.CurrentUser;
import com.smartbudget.category.Category;
import com.smartbudget.category.CategoryMemoryService;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(TransactionService.class);

    static final Set<String> SORTABLE_FIELDS = Set.of("transactionDate", "amount", "createdAt");
    static final int MAX_SEARCH_LENGTH = 100;

    private final TransactionRepository repository;
    private final CategoryService categoryService;
    private final MongoTemplate mongoTemplate;
    private final Clock clock;
    private final CurrentUser currentUser;
    private final CategoryMemoryService memory;

    public TransactionService(TransactionRepository repository, CategoryService categoryService,
                              MongoTemplate mongoTemplate, Clock clock, CurrentUser currentUser,
                              CategoryMemoryService memory) {
        this.repository = repository;
        this.categoryService = categoryService;
        this.mongoTemplate = mongoTemplate;
        this.clock = clock;
        this.currentUser = currentUser;
        this.memory = memory;
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
        Transaction saved = repository.save(tx);
        remember(saved, false);
        return toResponse(saved, category);
    }

    /** Importă mai multe tranzacții: dacă una singură e invalidă, nu se salvează nimic. */
    public BulkTransactionResponse createAll(BulkTransactionRequest request) {
        List<TransactionRequest> items = request.transactions();
        Map<String, Category> categories = categoryService.getByIds(
                items.stream().map(TransactionRequest::categoryId).distinct().toList());
        Instant now = clock.instant();
        List<Transaction> toSave = new ArrayList<>(items.size());
        for (int i = 0; i < items.size(); i++) {
            TransactionRequest item = items.get(i);
            Category category = categories.get(item.categoryId());
            if (category == null) {
                throw ApiException.unprocessable("Rândul " + (i + 1) + ": categoria nu există.");
            }
            if (category.getType() != item.type()) {
                throw ApiException.unprocessable("Rândul " + (i + 1) + ": tipul tranzacției (" + item.type()
                        + ") nu corespunde tipului categoriei (" + category.getType() + ").");
            }
            Transaction tx = new Transaction();
            tx.setUserId(currentUser.id());
            tx.setCreatedAt(now);
            apply(tx, item, now);
            toSave.add(tx);
        }
        repository.saveAll(toSave);
        return new BulkTransactionResponse(toSave.size());
    }

    public TransactionResponse update(String id, TransactionRequest request) {
        Transaction tx = find(id);
        Category category = validatedCategory(request);
        boolean recategorized = !request.categoryId().equals(tx.getCategoryId());
        apply(tx, request, clock.instant());
        Transaction saved = repository.save(tx);
        if (recategorized) {
            remember(saved, true);
        }
        return toResponse(saved, category);
    }

    /** Teaches the category memory; a failure there must not undo a saved transaction. */
    private void remember(Transaction tx, boolean corrected) {
        try {
            memory.learn(tx.getDescription(), tx.getType(), tx.getCategoryId(), corrected);
        } catch (RuntimeException ex) {
            log.warn("Could not update the category memory: {}", ex.getMessage());
        }
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
