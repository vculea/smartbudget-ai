package com.smartbudget.category;

import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

import com.smartbudget.auth.CurrentUser;
import com.smartbudget.budget.Budget;
import com.smartbudget.common.ApiException;
import com.smartbudget.transaction.Transaction;
import java.time.Clock;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/** Categories belong to the current user; every lookup is scoped by the user id. */
@Service
public class CategoryService {

    private final CategoryRepository repository;
    private final MongoTemplate mongoTemplate;
    private final CurrentUser currentUser;
    private final Clock clock;
    private final CategoryMemoryService memory;

    public CategoryService(CategoryRepository repository, MongoTemplate mongoTemplate, CurrentUser currentUser,
                           Clock clock, CategoryMemoryService memory) {
        this.repository = repository;
        this.mongoTemplate = mongoTemplate;
        this.currentUser = currentUser;
        this.clock = clock;
        this.memory = memory;
    }

    public List<CategoryResponse> list() {
        return repository.findByUserId(currentUser.id(), Sort.by("type", "name")).stream()
                .map(CategoryResponse::from).toList();
    }

    public Category getById(String id) {
        return repository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> ApiException.notFound("Categoria nu există."));
    }

    public Map<String, Category> getByIds(Collection<String> ids) {
        return repository.findByIdInAndUserId(ids, currentUser.id()).stream()
                .collect(Collectors.toMap(Category::getId, Function.identity()));
    }

    public CategoryResponse create(CategoryRequest request) {
        String userId = currentUser.id();
        Category category = new Category();
        category.setUserId(userId);
        apply(category, request);
        ensureUniqueName(userId, category, null);
        return CategoryResponse.from(save(category));
    }

    public CategoryResponse update(String id, CategoryRequest request) {
        Category category = getById(id);
        if (request.type() != category.getType() && usage(category).inUse()) {
            throw ApiException.conflict(
                    "Tipul categoriei nu poate fi schimbat cât timp are tranzacții sau bugete.");
        }
        apply(category, request);
        ensureUniqueName(category.getUserId(), category, category.getId());
        return CategoryResponse.from(save(category));
    }

    public CategoryUsageResponse usage(String id) {
        return usage(getById(id));
    }

    /**
     * Deletes a category. When transactions or budgets still use it, {@code replacementId} (a category of the same
     * type) is required: transactions move there, and so do budgets, except for months where the replacement already
     * has a budget (those budgets of the deleted category are removed).
     */
    public void delete(String id, String replacementId) {
        Category category = getById(id);
        CategoryUsageResponse usage = usage(category);
        boolean hasReplacement = replacementId != null && !replacementId.isBlank();
        if (usage.inUse() && !hasReplacement) {
            throw ApiException.conflict("Categoria este folosită de " + usage.transactions() + " tranzacții și "
                    + usage.budgets() + " bugete. Alege categoria în care să fie mutate.");
        }
        if (hasReplacement) {
            if (replacementId.equals(id)) {
                throw ApiException.badRequest("Alege o altă categorie decât cea pe care o ștergi.");
            }
            Category replacement = getById(replacementId);
            if (replacement.getType() != category.getType()) {
                throw ApiException.unprocessable("Categoria nouă trebuie să fie de același tip.");
            }
            moveUsages(category, replacement);
        }
        memory.moveCategory(category.getUserId(), category.getId(), hasReplacement ? replacementId : null);
        repository.delete(category);
    }

    private void moveUsages(Category from, Category to) {
        String userId = from.getUserId();
        mongoTemplate.updateMulti(byUserAndCategory(userId, from.getId()),
                new Update().set("categoryId", to.getId()).set("updatedAt", clock.instant()), Transaction.class);
        for (Budget budget : mongoTemplate.find(byUserAndCategory(userId, from.getId()), Budget.class)) {
            boolean taken = mongoTemplate.exists(byUserAndCategory(userId, to.getId())
                    .addCriteria(where("month").is(budget.getMonth())), Budget.class);
            if (taken) {
                mongoTemplate.remove(budget);
            } else {
                budget.setCategoryId(to.getId());
                budget.setUpdatedAt(clock.instant());
                mongoTemplate.save(budget);
            }
        }
    }

    private CategoryUsageResponse usage(Category category) {
        Query query = byUserAndCategory(category.getUserId(), category.getId());
        return new CategoryUsageResponse(mongoTemplate.count(query, Transaction.class),
                mongoTemplate.count(query, Budget.class));
    }

    private static Query byUserAndCategory(String userId, String categoryId) {
        return query(where("userId").is(userId).and("categoryId").is(categoryId));
    }

    private static void apply(Category category, CategoryRequest request) {
        category.setName(request.name().strip());
        category.setType(request.type());
        category.setColor(blankToNull(request.color()));
        category.setIcon(blankToNull(request.icon()));
    }

    /** Case-insensitive, so "alimente" cannot sit next to "Alimente". */
    private void ensureUniqueName(String userId, Category category, String excludedId) {
        boolean duplicate = repository.findByUserId(userId, Sort.unsorted()).stream()
                .filter(c -> !c.getId().equals(excludedId))
                .anyMatch(c -> c.getType() == category.getType() && c.getName().equalsIgnoreCase(category.getName()));
        if (duplicate) {
            throw duplicateName();
        }
    }

    private Category save(Category category) {
        try {
            return repository.save(category);
        } catch (DuplicateKeyException ex) {
            throw duplicateName();
        }
    }

    private static ApiException duplicateName() {
        return ApiException.conflict("Ai deja o categorie cu acest nume și tip.");
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
