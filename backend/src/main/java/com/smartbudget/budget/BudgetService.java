package com.smartbudget.budget;

import com.smartbudget.category.Category;
import com.smartbudget.category.CategoryService;
import com.smartbudget.common.ApiException;
import com.smartbudget.common.Money;
import com.smartbudget.transaction.TransactionStatsService;
import com.smartbudget.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

@Service
public class BudgetService {

    private final BudgetRepository repository;
    private final CategoryService categoryService;
    private final TransactionStatsService statsService;
    private final Clock clock;

    public BudgetService(BudgetRepository repository, CategoryService categoryService,
                         TransactionStatsService statsService, Clock clock) {
        this.repository = repository;
        this.categoryService = categoryService;
        this.statsService = statsService;
        this.clock = clock;
    }

    public List<BudgetResponse> list(YearMonth month) {
        Map<String, BigDecimal> spentByCategory =
                statsService.expensesByCategory(month.atDay(1), month.atEndOfMonth());
        return list(month, spentByCategory);
    }

    /** Variant for callers that already computed the monthly expenses per category. */
    public List<BudgetResponse> list(YearMonth month, Map<String, BigDecimal> spentByCategory) {
        List<Budget> budgets = repository.findByMonth(month.toString());
        Map<String, Category> categories = categoryService.getByIds(
                budgets.stream().map(Budget::getCategoryId).distinct().toList());
        return budgets.stream()
                .map(budget -> toResponse(budget, categories.get(budget.getCategoryId()),
                        spentByCategory.getOrDefault(budget.getCategoryId(), BigDecimal.ZERO)))
                .sorted(Comparator.comparing(BudgetResponse::categoryName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }

    public BudgetResponse create(BudgetRequest request) {
        Category category = categoryService.getById(request.categoryId());
        if (category.getType() != TransactionType.EXPENSE) {
            throw ApiException.unprocessable("Bugetele pot fi definite doar pentru categorii de cheltuieli.");
        }
        String month = request.month().toString();
        if (repository.existsByCategoryIdAndMonth(category.getId(), month)) {
            throw duplicate();
        }

        Budget budget = new Budget();
        Instant now = clock.instant();
        budget.setCategoryId(category.getId());
        budget.setMonth(month);
        budget.setLimitAmount(Money.scale(request.limitAmount()));
        budget.setCreatedAt(now);
        budget.setUpdatedAt(now);
        try {
            budget = repository.save(budget);
        } catch (DuplicateKeyException ex) {
            throw duplicate();
        }

        BigDecimal spent = statsService.expensesByCategory(request.month().atDay(1), request.month().atEndOfMonth())
                .getOrDefault(category.getId(), BigDecimal.ZERO);
        return toResponse(budget, category, spent);
    }

    private ApiException duplicate() {
        return ApiException.conflict("Există deja un buget pentru această categorie în luna selectată.");
    }

    private BudgetResponse toResponse(Budget budget, Category category, BigDecimal spent) {
        BigDecimal limit = budget.getLimitAmount();
        return new BudgetResponse(budget.getId(), budget.getCategoryId(),
                category == null ? null : category.getName(), YearMonth.parse(budget.getMonth()),
                Money.scale(limit), Money.scale(spent), Money.scale(limit.subtract(spent)),
                Money.percentage(spent, limit), BudgetCalculator.status(spent, limit));
    }
}
