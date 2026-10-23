package com.smartbudget.budget;

import com.smartbudget.auth.CurrentUser;
import com.smartbudget.category.Category;
import com.smartbudget.category.CategoryService;
import com.smartbudget.common.ApiException;
import com.smartbudget.common.Money;
import com.smartbudget.common.Years;
import com.smartbudget.transaction.TransactionStatsService;
import com.smartbudget.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

    /** Variant for callers that already computed the monthly expenses per category. Only expense budgets. */
    public List<BudgetResponse> list(YearMonth month, Map<String, BigDecimal> spentByCategory) {
        List<Budget> budgets = repository.findByUserIdAndMonth(currentUser.id(), month.toString());
        Map<String, Category> categories = categoryService.getByIds(
                budgets.stream().map(Budget::getCategoryId).distinct().toList());
        return budgets.stream()
                .filter(budget -> isExpense(categories.get(budget.getCategoryId())))
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

    /** Yearly view: limits of the same category are summed across the months of the year. Only expense budgets. */
    public List<BudgetResponse> listForYear(int year, Map<String, BigDecimal> spentByCategory) {
        Map<String, BigDecimal> limitByCategory = new LinkedHashMap<>();
        for (Budget budget : repository.findByUserIdAndMonthStartingWith(currentUser.id(), year + "-")) {
            limitByCategory.merge(budget.getCategoryId(), budget.getLimitAmount(), BigDecimal::add);
        }
        Map<String, Category> categories = categoryService.getByIds(limitByCategory.keySet());
        String yearKey = String.valueOf(year);
        return limitByCategory.entrySet().stream()
                .filter(entry -> isExpense(categories.get(entry.getKey())))
                .map(entry -> {
                    Category category = categories.get(entry.getKey());
                    BigDecimal limit = entry.getValue();
                    BigDecimal spent = spentByCategory.getOrDefault(entry.getKey(), BigDecimal.ZERO);
                    return toResponse(yearKey + ":" + entry.getKey(), entry.getKey(), category, yearKey, limit, spent);
                })
                .sorted(Comparator.comparing(BudgetResponse::categoryName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }

    /** Planned incomes of a month (budgets on income categories) compared with the income received. */
    public List<IncomePlanResponse> listIncome(YearMonth month) {
        Map<String, BigDecimal> received = statsService.incomesByCategory(month.atDay(1), month.atEndOfMonth());
        List<Budget> budgets = repository.findByUserIdAndMonth(currentUser.id(), month.toString());
        return incomePlans(budgets, month.toString(), false, received, month.isBefore(YearMonth.now(clock)));
    }

    /** Yearly view of the planned incomes: the monthly amounts of a category are summed over the year. */
    public List<IncomePlanResponse> listIncomeForYear(int year) {
        Map<String, BigDecimal> received =
                statsService.incomesByCategory(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
        List<Budget> budgets = repository.findByUserIdAndMonthStartingWith(currentUser.id(), year + "-");
        return incomePlans(budgets, String.valueOf(year), true, received, year < LocalDate.now(clock).getYear());
    }

    private List<IncomePlanResponse> incomePlans(List<Budget> budgets, String period, boolean yearly,
            Map<String, BigDecimal> received, boolean periodEnded) {
        Map<String, BigDecimal> expectedByCategory = new LinkedHashMap<>();
        Map<String, String> idByCategory = new HashMap<>();
        for (Budget budget : budgets) {
            expectedByCategory.merge(budget.getCategoryId(), budget.getLimitAmount(), BigDecimal::add);
            idByCategory.putIfAbsent(budget.getCategoryId(),
                    yearly ? period + ":" + budget.getCategoryId() : budget.getId());
        }
        Map<String, Category> categories = categoryService.getByIds(expectedByCategory.keySet());
        return expectedByCategory.entrySet().stream()
                .filter(entry -> {
                    Category category = categories.get(entry.getKey());
                    return category != null && category.getType() == TransactionType.INCOME;
                })
                .map(entry -> {
                    BigDecimal expected = Money.scale(entry.getValue());
                    BigDecimal got = Money.scale(received.getOrDefault(entry.getKey(), BigDecimal.ZERO));
                    BigDecimal missing = expected.subtract(got).max(BigDecimal.ZERO);
                    IncomePlanStatus status = got.compareTo(expected) >= 0 ? IncomePlanStatus.REACHED
                            : periodEnded ? IncomePlanStatus.BELOW : IncomePlanStatus.PENDING;
                    return new IncomePlanResponse(idByCategory.get(entry.getKey()), entry.getKey(),
                            categories.get(entry.getKey()).getName(), period, expected, got, missing,
                            Money.percentage(got, expected), status);
                })
                .sorted(Comparator.comparing(IncomePlanResponse::categoryName, String::compareToIgnoreCase))
                .toList();
    }

    /** Budgets whose category was removed keep being shown as expense budgets, as before. */
    private static boolean isExpense(Category category) {
        return category == null || category.getType() == TransactionType.EXPENSE;
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

    /**
     * Creates the budget of each category for every chosen month of the year: a spending limit for expense
     * categories, the expected amount for income categories. Months where the category already has one are skipped,
     * so existing amounts are never overwritten.
     */
    public BudgetYearResponse createForYear(BudgetYearRequest request) {
        int year = Years.require(request.year());
        List<Integer> months = request.months().stream().distinct().sorted().toList();
        Set<String> categoryIds = new HashSet<>();
        for (BudgetYearRequest.Item item : request.items()) {
            if (!categoryIds.add(item.categoryId())) {
                throw ApiException.badRequest("O categorie apare de mai multe ori în listă.");
            }
            categoryService.getById(item.categoryId());
        }

        String userId = currentUser.id();
        Set<String> existing = new HashSet<>();
        for (Budget budget : repository.findByUserIdAndMonthStartingWith(userId, year + "-")) {
            existing.add(budget.getCategoryId() + "|" + budget.getMonth());
        }

        Instant now = clock.instant();
        int created = 0;
        int skipped = 0;
        for (BudgetYearRequest.Item item : request.items()) {
            for (int month : months) {
                String key = YearMonth.of(year, month).toString();
                if (existing.contains(item.categoryId() + "|" + key)) {
                    skipped++;
                    continue;
                }
                Budget budget = new Budget();
                budget.setUserId(userId);
                budget.setCategoryId(item.categoryId());
                budget.setMonth(key);
                budget.setLimitAmount(Money.scale(item.limitAmount()));
                budget.setCreatedAt(now);
                budget.setUpdatedAt(now);
                try {
                    repository.save(budget);
                    created++;
                } catch (DuplicateKeyException ex) {
                    // Created meanwhile (e.g. another tab): it stays as it is.
                    skipped++;
                }
            }
        }
        return new BudgetYearResponse(created, skipped);
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
