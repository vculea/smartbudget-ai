package com.smartbudget.transaction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smartbudget.TestClock;
import com.smartbudget.TestUser;
import com.smartbudget.category.Category;
import com.smartbudget.category.CategoryMemoryService;
import com.smartbudget.category.CategoryService;
import com.smartbudget.common.ApiException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;

class TransactionServiceTest {

    private final TransactionRepository repository = mock(TransactionRepository.class);
    private final CategoryService categories = mock(CategoryService.class);
    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final CategoryMemoryService memory = mock(CategoryMemoryService.class);
    private TransactionService service;

    @BeforeEach
    void setUp() {
        service = new TransactionService(repository, categories, mongoTemplate, TestClock.FIXED, TestUser.current(),
                memory);
        when(repository.save(any(Transaction.class))).thenAnswer(inv -> {
            Transaction tx = inv.getArgument(0);
            if (tx.getId() == null) {
                tx.setId("t1");
            }
            return tx;
        });
    }

    @Test
    void createsTransactionWithTimestampsAndNormalizedFields() {
        when(categories.getById("food")).thenReturn(new Category("food", "Alimente", TransactionType.EXPENSE, null, null));

        TransactionResponse response = service.create(new TransactionRequest(TransactionType.EXPENSE,
                new BigDecimal("42.5"), "  Supermarket  ", LocalDate.of(2026, 10, 3), "food"));

        assertThat(response.id()).isEqualTo("t1");
        assertThat(response.amount()).isEqualByComparingTo("42.50");
        assertThat(response.description()).isEqualTo("Supermarket");
        assertThat(response.categoryName()).isEqualTo("Alimente");
        assertThat(response.createdAt()).isEqualTo(TestClock.FIXED.instant());
        assertThat(response.updatedAt()).isEqualTo(TestClock.FIXED.instant());
    }

    @Test
    void rejectsTypeThatDoesNotMatchCategoryType() {
        when(categories.getById("salary")).thenReturn(new Category("salary", "Salariu", TransactionType.INCOME, null, null));

        assertThatThrownBy(() -> service.create(new TransactionRequest(TransactionType.EXPENSE,
                BigDecimal.TEN, "x", LocalDate.of(2026, 10, 3), "salary")))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY));
        verify(repository, never()).save(any());
    }

    @Test
    void rejectsUnknownCategory() {
        when(categories.getById("nope")).thenThrow(ApiException.notFound("Categoria nu există."));

        assertThatThrownBy(() -> service.create(new TransactionRequest(TransactionType.EXPENSE,
                BigDecimal.TEN, "x", LocalDate.of(2026, 10, 3), "nope")))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void updatesExistingTransactionKeepingCreatedAt() {
        Transaction existing = new Transaction();
        existing.setId("t1");
        existing.setType(TransactionType.EXPENSE);
        existing.setAmount(new BigDecimal("10.00"));
        existing.setDescription("old");
        existing.setCategoryId("food");
        existing.setTransactionDate(LocalDate.of(2026, 9, 1));
        existing.setCreatedAt(java.time.Instant.parse("2026-09-01T00:00:00Z"));
        when(repository.findByIdAndUserId("t1", TestUser.ID)).thenReturn(Optional.of(existing));
        when(categories.getById("food")).thenReturn(new Category("food", "Alimente", TransactionType.EXPENSE, null, null));

        TransactionResponse response = service.update("t1", new TransactionRequest(TransactionType.EXPENSE,
                new BigDecimal("99.99"), "new", LocalDate.of(2026, 10, 5), "food"));

        assertThat(response.amount()).isEqualByComparingTo("99.99");
        assertThat(response.description()).isEqualTo("new");
        assertThat(response.transactionDate()).isEqualTo(LocalDate.of(2026, 10, 5));
        assertThat(response.createdAt()).isEqualTo(java.time.Instant.parse("2026-09-01T00:00:00Z"));
        assertThat(response.updatedAt()).isEqualTo(TestClock.FIXED.instant());
        verify(memory, never()).learn(any(), any(), any(), org.mockito.ArgumentMatchers.anyBoolean());
    }

    @Test
    void changingTheCategoryTeachesTheMemoryAsACorrection() {
        Transaction existing = new Transaction();
        existing.setId("t1");
        existing.setType(TransactionType.EXPENSE);
        existing.setAmount(new BigDecimal("10.00"));
        existing.setDescription("GLOVO 123");
        existing.setCategoryId("food");
        existing.setTransactionDate(LocalDate.of(2026, 9, 1));
        when(repository.findByIdAndUserId("t1", TestUser.ID)).thenReturn(Optional.of(existing));
        when(categories.getById("fun")).thenReturn(new Category("fun", "Ieșiri", TransactionType.EXPENSE, null, null));

        service.update("t1", new TransactionRequest(TransactionType.EXPENSE, BigDecimal.TEN, "GLOVO 123",
                LocalDate.of(2026, 9, 1), "fun"));

        verify(memory).learn("GLOVO 123", TransactionType.EXPENSE, "fun", true);
    }

    @Test
    void aMemoryFailureDoesNotFailTheSavedTransaction() {
        when(categories.getById("food")).thenReturn(new Category("food", "Alimente", TransactionType.EXPENSE, null, null));
        org.mockito.Mockito.doThrow(new IllegalStateException("down")).when(memory)
                .learn(any(), any(), any(), org.mockito.ArgumentMatchers.anyBoolean());

        TransactionResponse response = service.create(new TransactionRequest(TransactionType.EXPENSE, BigDecimal.TEN,
                "Cafea", LocalDate.of(2026, 10, 3), "food"));

        assertThat(response.id()).isEqualTo("t1");
        verify(memory).learn("Cafea", TransactionType.EXPENSE, "food", false);
    }

    @Test
    void updateOfMissingTransactionIsNotFound() {
        when(repository.findByIdAndUserId("missing", TestUser.ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update("missing", new TransactionRequest(TransactionType.EXPENSE,
                BigDecimal.TEN, "x", LocalDate.of(2026, 10, 3), "food")))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void deletesExistingTransaction() {
        when(repository.deleteByIdAndUserId("t1", TestUser.ID)).thenReturn(1L);

        service.delete("t1");

        verify(repository).deleteByIdAndUserId("t1", TestUser.ID);
    }

    @Test
    void deleteOfMissingOrForeignTransactionIsNotFound() {
        when(repository.deleteByIdAndUserId("missing", TestUser.ID)).thenReturn(0L);

        assertThatThrownBy(() -> service.delete("missing"))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void createStoresTransactionForCurrentUser() {
        when(categories.getById("food")).thenReturn(new Category("food", "Alimente", TransactionType.EXPENSE, null, null));

        service.create(new TransactionRequest(TransactionType.EXPENSE, BigDecimal.TEN, "x",
                LocalDate.of(2026, 10, 3), "food"));

        verify(repository).save(org.mockito.ArgumentMatchers.argThat((Transaction tx) ->
                TestUser.ID.equals(tx.getUserId())));
    }

    @Test
    void listRejectsSortByUnknownField() {
        PageRequest pageable = PageRequest.of(0, 10, Sort.by("description"));

        assertThatThrownBy(() -> service.list(new TransactionFilter(null, null, null, null, null), pageable))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void listRejectsInvertedDateRange() {
        PageRequest pageable = PageRequest.of(0, 10);
        TransactionFilter filter = new TransactionFilter(null, null, LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 1), null);

        assertThatThrownBy(() -> service.list(filter, pageable))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void createAllSavesEveryItemForTheCurrentUser() {
        when(categories.getByIds(any())).thenReturn(java.util.Map.of(
                "food", new Category("food", "Alimente", TransactionType.EXPENSE, null, null),
                "salary", new Category("salary", "Salariu", TransactionType.INCOME, null, null)));

        BulkTransactionResponse response = service.createAll(new BulkTransactionRequest(java.util.List.of(
                new TransactionRequest(TransactionType.EXPENSE, new BigDecimal("12.5"), " Cafea ", LocalDate.of(2026, 10, 3), "food"),
                new TransactionRequest(TransactionType.INCOME, new BigDecimal("1000"), "Salariu", LocalDate.of(2026, 10, 1), "salary"))));

        assertThat(response.created()).isEqualTo(2);
        org.mockito.ArgumentCaptor<Iterable<Transaction>> saved = org.mockito.ArgumentCaptor.forClass(Iterable.class);
        verify(repository).saveAll(saved.capture());
        assertThat(saved.getValue()).hasSize(2).allSatisfy(tx -> {
            assertThat(tx.getUserId()).isEqualTo(TestUser.ID);
            assertThat(tx.getCreatedAt()).isEqualTo(TestClock.FIXED.instant());
        }).first().satisfies(tx -> {
            assertThat(tx.getDescription()).isEqualTo("Cafea");
            assertThat(tx.getAmount()).isEqualByComparingTo("12.50");
        });
    }

    @Test
    void createAllSavesNothingWhenOneItemIsInvalid() {
        when(categories.getByIds(any())).thenReturn(java.util.Map.of(
                "food", new Category("food", "Alimente", TransactionType.EXPENSE, null, null)));

        BulkTransactionRequest request = new BulkTransactionRequest(java.util.List.of(
                new TransactionRequest(TransactionType.EXPENSE, BigDecimal.TEN, "ok", LocalDate.of(2026, 10, 3), "food"),
                new TransactionRequest(TransactionType.INCOME, BigDecimal.TEN, "greșit", LocalDate.of(2026, 10, 3), "food")));

        assertThatThrownBy(() -> service.createAll(request))
                .isInstanceOfSatisfying(ApiException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
                    assertThat(ex.getMessage()).startsWith("Rândul 2");
                });
        verify(repository, never()).saveAll(any());
    }

    @Test
    void createAllRejectsUnknownCategory() {
        when(categories.getByIds(any())).thenReturn(java.util.Map.of());

        BulkTransactionRequest request = new BulkTransactionRequest(java.util.List.of(
                new TransactionRequest(TransactionType.EXPENSE, BigDecimal.TEN, "x", LocalDate.of(2026, 10, 3), "nope")));

        assertThatThrownBy(() -> service.createAll(request))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY));
        verify(repository, never()).saveAll(any());
    }
}
