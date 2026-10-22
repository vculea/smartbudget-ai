package com.smartbudget.budget;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smartbudget.TestClock;
import com.smartbudget.category.Category;
import com.smartbudget.category.CategoryService;
import com.smartbudget.common.ApiException;
import com.smartbudget.transaction.TransactionStatsService;
import com.smartbudget.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;

class BudgetServiceTest {

    private static final YearMonth MONTH = YearMonth.of(2026, 10);

    private final BudgetRepository repository = mock(BudgetRepository.class);
    private final CategoryService categories = mock(CategoryService.class);
    private final TransactionStatsService stats = mock(TransactionStatsService.class);
    private BudgetService service;

    @BeforeEach
    void setUp() {
        service = new BudgetService(repository, categories, stats, TestClock.FIXED);
        when(repository.save(any(Budget.class))).thenAnswer(inv -> {
            Budget b = inv.getArgument(0);
            b.setId("b1");
            return b;
        });
        when(stats.expensesByCategory(any(), any())).thenReturn(Map.of());
    }

    @ParameterizedTest
    @CsvSource({
            "0, NORMAL",
            "799.99, NORMAL",
            "800, WARNING",
            "950, WARNING",
            "1000, WARNING",
            "1000.01, EXCEEDED",
            "1500, EXCEEDED"
    })
    void statusThresholdsForLimit1000(String spent, BudgetStatus expected) {
        assertThat(BudgetCalculator.status(new BigDecimal(spent), new BigDecimal("1000"))).isEqualTo(expected);
    }

    @Test
    void createsBudgetForExpenseCategory() {
        when(categories.getById("c1")).thenReturn(expenseCategory());
        when(repository.existsByCategoryIdAndMonth("c1", "2026-10")).thenReturn(false);

        BudgetResponse response = service.create(new BudgetRequest("c1", MONTH, new BigDecimal("500")));

        assertThat(response.id()).isEqualTo("b1");
        assertThat(response.limitAmount()).isEqualByComparingTo("500.00");
        assertThat(response.spentAmount()).isEqualByComparingTo("0");
        assertThat(response.status()).isEqualTo(BudgetStatus.NORMAL);
    }

    @Test
    void rejectsDuplicateBudgetForSameCategoryAndMonth() {
        when(categories.getById("c1")).thenReturn(expenseCategory());
        when(repository.existsByCategoryIdAndMonth("c1", "2026-10")).thenReturn(true);

        assertThatThrownBy(() -> service.create(new BudgetRequest("c1", MONTH, new BigDecimal("500"))))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT));
        verify(repository, never()).save(any());
    }

    @Test
    void mapsUniqueIndexViolationToConflict() {
        when(categories.getById("c1")).thenReturn(expenseCategory());
        when(repository.existsByCategoryIdAndMonth("c1", "2026-10")).thenReturn(false);
        when(repository.save(any(Budget.class))).thenThrow(new DuplicateKeyException("E11000 duplicate key"));

        assertThatThrownBy(() -> service.create(new BudgetRequest("c1", MONTH, new BigDecimal("500"))))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void rejectsBudgetForIncomeCategory() {
        when(categories.getById("c2")).thenReturn(new Category("c2", "Salariu", TransactionType.INCOME, null, null));

        assertThatThrownBy(() -> service.create(new BudgetRequest("c2", MONTH, new BigDecimal("500"))))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY));
    }

    @Test
    void rejectsBudgetForUnknownCategory() {
        when(categories.getById("zzz")).thenThrow(ApiException.notFound("Categoria nu există."));

        assertThatThrownBy(() -> service.create(new BudgetRequest("zzz", MONTH, new BigDecimal("500"))))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void listIncludesSpentRemainingPercentageAndStatus() {
        Budget warning = budget("b-warn", "c1", "1000");
        Budget exceeded = budget("b-exc", "c2", "200");
        Budget normal = budget("b-ok", "c3", "400");
        when(repository.findByMonth("2026-10")).thenReturn(List.of(warning, exceeded, normal));
        when(categories.getByIds(any())).thenReturn(Map.of(
                "c1", new Category("c1", "Alimente", TransactionType.EXPENSE, null, null),
                "c2", new Category("c2", "Divertisment", TransactionType.EXPENSE, null, null),
                "c3", new Category("c3", "Transport", TransactionType.EXPENSE, null, null)));
        when(stats.expensesByCategory(any(), any())).thenReturn(Map.of(
                "c1", new BigDecimal("800"), "c2", new BigDecimal("250"), "c3", new BigDecimal("100")));

        List<BudgetResponse> result = service.list(MONTH);

        assertThat(result).extracting(BudgetResponse::categoryName).containsExactly("Alimente", "Divertisment", "Transport");
        BudgetResponse food = result.get(0);
        assertThat(food.status()).isEqualTo(BudgetStatus.WARNING);
        assertThat(food.percentageUsed()).isEqualByComparingTo("80.00");
        assertThat(food.remainingAmount()).isEqualByComparingTo("200.00");
        BudgetResponse fun = result.get(1);
        assertThat(fun.status()).isEqualTo(BudgetStatus.EXCEEDED);
        assertThat(fun.percentageUsed()).isEqualByComparingTo("125.00");
        assertThat(fun.remainingAmount()).isEqualByComparingTo("-50.00");
        assertThat(result.get(2).status()).isEqualTo(BudgetStatus.NORMAL);
    }

    @Test
    void yearlyListSumsLimitsPerCategoryAndComparesWithYearlySpending() {
        Budget oct = budget("b1", "c1", "1000");
        Budget nov = budget("b2", "c1", "500");
        nov.setMonth("2026-11");
        when(repository.findByMonthStartingWith("2026-")).thenReturn(List.of(oct, nov));
        when(categories.getByIds(any())).thenReturn(Map.of("c1", expenseCategory()));
        when(stats.expensesByCategory(any(), any())).thenReturn(Map.of("c1", new BigDecimal("1800")));

        List<BudgetResponse> result = service.listForYear(2026);

        assertThat(result).hasSize(1);
        BudgetResponse yearly = result.get(0);
        assertThat(yearly.month()).isEqualTo("2026");
        assertThat(yearly.limitAmount()).isEqualByComparingTo("1500.00");
        assertThat(yearly.spentAmount()).isEqualByComparingTo("1800.00");
        assertThat(yearly.status()).isEqualTo(BudgetStatus.EXCEEDED);
        assertThat(yearly.id()).isEqualTo("2026:c1");
    }

    private static Category expenseCategory() {
        return new Category("c1", "Alimente", TransactionType.EXPENSE, null, null);
    }

    private static Budget budget(String id, String categoryId, String limit) {
        Budget b = new Budget();
        b.setId(id);
        b.setCategoryId(categoryId);
        b.setMonth("2026-10");
        b.setLimitAmount(new BigDecimal(limit));
        return b;
    }
}
