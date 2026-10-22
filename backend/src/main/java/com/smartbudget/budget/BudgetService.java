package com.smartbudget.budget;

import com.smartbudget.auth.CurrentUser;
import com.smartbudget.category.Category;
import com.smartbudget.category.CategoryService;
import com.smartbudget.common.ApiException;
import com.smartbudget.common.Money;
import com.smartbudget.transaction.TransactionStatsService;
import com.smartbudget.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.LinkedHashMap;
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
    private final CurrentUser currentUser;

    public BudgetService(BudgetRepository repository, CategoryService categoryService,
                         TransactionStatsService statsService, Clock clock, CurrentUser currentUser) {
        this.repository = repository;
        this.categoryService = categoryService;
        this.statsService = statsService;
        this.clock = clock;
        this.currentUser = currentUser;
    }

    public List<BudgetResponse> list(YearMonth month) {
        Map<String, BigDecimal> spentByCategory =
                statsService.expensesByCategory(month.atDay(1), month.atEndOfMonth());
        return list(month, spentByCategory);
    }

    /** Variant for callers that already computed the monthly expenses per category. */
    public List<BudgetResponse> list(YearMonth month, Map<String, BigDecimal> spentByCategory) {
        List<Budget> budgets = repository.findByUserIdAndMonth(currentUser.id(), month.toString());
        Map<String, Category> categories = categoryService.getByIds(
                budgets.stream().map(Budget::getCategoryId).distinct().toList());
        return budgets.stream()
                .map(budget -> toResponse(budget, categories.get(budget.getCategoryId()),
                        spentByCategory.getOrDefault(budget.getCategoryId(), BigDecimal.ZERO)))
                .sorted(Comparator.comparing(BudgetResponse::categoryName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }

    public List<BudgetResponse> listForYear(int year) {
        Map<String, BigDecimal> spentByCategory =
                statsService.expensesByCategory(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
        return listForYear(year, spentByCategory);
    }

    /** Yearly view: limits of the same category are summed across the months of the year. */
    public List<BudgetResponse> listForYear(int year, Map<String, BigDecimal> spentByCategory) {
        Map<String, BigDecimal> limitByCategory = new LinkedHashMap<>();
        for (Budget budget : repository.findByUserIdAndMonthStartingWith(currentUser.id(), year + "-")) {
            limitByCategory.merge(budget.getCategoryId(), budget.getLimitAmount(), BigDecimal::add);
        }
        Map<String, Category> categories = categoryService.getByIds(limitByCategory.keySet());
        String yearKey = String.valueOf(year);
        return limitByCategory.entrySet().stream()
                .map(entry -> {
                    Category category = categories.get(entry.getKey());
                    BigDecimal limit = entry.getValue();
                    BigDecimal spent = spentByCategory.getOrDefault(entry.getKey(), BigDecimal.ZERO);
                    return toResponse(yearKey + ":" + entry.getKey(), entry.getKey(), category, yearKey, limit, spent);
                })
                .sorted(Comparator.comparing(BudgetResponse::categoryName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }

    public BudgetResponse create(BudgetRequest request) {
        Category category = categoryService.getById(request.categoryId());
        if (category.getType() != TransactionType.EXPENSE) {
            throw ApiException.unprocessable("Bugetele pot fi definite doar pentru categorii de cheltuieli.");
        }
        String month = request.month().toString();
        String userId = currentUser.id();
        if (repository.existsByUserIdAndCategoryIdAndMonth(userId, category.getId(), month)) {
            throw duplicate();
        }

        Budget budget = new Budget();
        Instant now = clock.instant();
        budget.setUserId(userId);
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
        return toResponse(budget.getId(), budget.getCategoryId(), category, budget.getMonth(),
                budget.getLimitAmount(), spent);
    }

    private BudgetResponse toResponse(String id, String categoryId, Category category, String period,
                                      BigDecimal limit, BigDecimal spent) {
        return new BudgetResponse(id, categoryId, category == null ? null : category.getName(), period,
                Money.scale(limit), Money.scale(spent), Money.scale(limit.subtract(spent)),
                Money.percentage(spent, limit), BudgetCalculator.status(spent, limit));
    }
}
