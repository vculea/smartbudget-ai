package com.smartbudget;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartbudget.ai.AiAnalysis;
import com.smartbudget.ai.AiAnalysisService;
import com.smartbudget.ai.FinancialSummary;
import com.smartbudget.budget.Budget;
import com.smartbudget.budget.BudgetRepository;
import com.smartbudget.category.Category;
import com.smartbudget.category.CategoryRepository;
import com.smartbudget.category.DefaultCategories;
import com.smartbudget.common.ApiException;
import com.smartbudget.config.CategoryOwnershipMigration;
import com.smartbudget.config.DemoDataSeeder;
import com.smartbudget.goal.GoalContributionRepository;
import com.smartbudget.goal.SavingsGoalRepository;
import com.smartbudget.transaction.Transaction;
import com.smartbudget.transaction.TransactionRepository;
import com.smartbudget.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.bson.Document;
import org.bson.types.Decimal128;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** End-to-end API tests on a real, isolated MongoDB (Testcontainers). Skipped when Docker is unavailable. */
@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(username = TestUser.ID)
@Testcontainers(disabledWithoutDocker = true)
class ApiIntegrationTest {

    @Container
    @ServiceConnection
    static MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @Autowired
    MockMvc mvc;
    @Autowired
    ObjectMapper json;
    @Autowired
    MongoTemplate mongoTemplate;
    @Autowired
    CategoryRepository categories;
    @Autowired
    TransactionRepository transactions;
    @Autowired
    BudgetRepository budgets;
    @Autowired
    SavingsGoalRepository goals;
    @Autowired
    GoalContributionRepository contributions;
    @MockitoBean
    AiAnalysisService ai;

    @BeforeEach
    void cleanDatabase() {
        transactions.deleteAll();
        budgets.deleteAll();
        contributions.deleteAll();
        goals.deleteAll();
        categories.deleteAll();
        Mockito.reset(ai);
        categories.save(new Category("salary", TestUser.ID, "Salariu", TransactionType.INCOME, "#10b981", "briefcase"));
        categories.save(new Category("food", TestUser.ID, "Alimente", TransactionType.EXPENSE, "#4f46e5", "cart"));
        categories.save(new Category("fun", TestUser.ID, "Divertisment", TransactionType.EXPENSE, "#ec4899", "film"));
    }

    @Test
    void categoriesEndpointListsAvailableCategories() throws Exception {
        mvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[?(@.id=='food')].name").value("Alimente"));
    }

    @Test
    void categoryCrudLifecycle() throws Exception {
        MvcResult created = mvc.perform(post("/api/v1/categories").contentType(MediaType.APPLICATION_JSON)
                        .content(categoryJson(" Abonamente ", "EXPENSE", "#123abc")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Abonamente"))
                .andExpect(jsonPath("$.color").value("#123abc"))
                .andReturn();
        String id = json.readTree(created.getResponse().getContentAsString()).get("id").asText();
        assertThat(categories.findById(id)).get().extracting(Category::getUserId).isEqualTo(TestUser.ID);

        mvc.perform(post("/api/v1/categories").contentType(MediaType.APPLICATION_JSON)
                        .content(categoryJson("abonamente", "EXPENSE", null)))
                .andExpect(status().isConflict());
        // the same name is allowed for the other type
        mvc.perform(post("/api/v1/categories").contentType(MediaType.APPLICATION_JSON)
                        .content(categoryJson("Abonamente", "INCOME", null)))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/categories").contentType(MediaType.APPLICATION_JSON)
                        .content(categoryJson("", "EXPENSE", "red")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.name").exists())
                .andExpect(jsonPath("$.fieldErrors.color").exists());

        mvc.perform(put("/api/v1/categories/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content(categoryJson("Abonamente lunare", "INCOME", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Abonamente lunare"))
                .andExpect(jsonPath("$.type").value("INCOME"))
                .andExpect(jsonPath("$.color").doesNotExist());
        mvc.perform(put("/api/v1/categories/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content(categoryJson("Salariu", "INCOME", null)))
                .andExpect(status().isConflict());

        mvc.perform(delete("/api/v1/categories/" + id)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/v1/categories/" + id)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/categories")).andExpect(jsonPath("$.length()").value(4));
    }

    @Test
    void categoryInUseKeepsItsTypeAndMovesItsDataWhenDeleted() throws Exception {
        String txId = createTransaction("EXPENSE", "80", "Cinema", "2026-09-20", "fun");
        seedBudget("fun", "2026-09", "100");
        seedBudget("fun", "2026-10", "200");
        seedBudget("food", "2026-10", "900");

        mvc.perform(get("/api/v1/categories/fun/usage"))
                .andExpect(jsonPath("$.transactions").value(1))
                .andExpect(jsonPath("$.budgets").value(2));
        mvc.perform(put("/api/v1/categories/fun").contentType(MediaType.APPLICATION_JSON)
                        .content(categoryJson("Distracție", "INCOME", null)))
                .andExpect(status().isConflict());
        mvc.perform(put("/api/v1/categories/fun").contentType(MediaType.APPLICATION_JSON)
                        .content(categoryJson("Distracție", "EXPENSE", "#000000")))
                .andExpect(status().isOk());

        mvc.perform(delete("/api/v1/categories/fun")).andExpect(status().isConflict());
        mvc.perform(delete("/api/v1/categories/fun").param("replacementId", "salary"))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(delete("/api/v1/categories/fun").param("replacementId", "fun"))
                .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/v1/categories/fun").param("replacementId", "food"))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/v1/transactions/" + txId)).andExpect(jsonPath("$.categoryId").value("food"));
        // September moved to food; October already had a food budget, so fun's was removed
        assertThat(budgets.findAll()).extracting(Budget::getMonth, Budget::getCategoryId, b -> b.getLimitAmount().intValue())
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("2026-09", "food", 100),
                        org.assertj.core.groups.Tuple.tuple("2026-10", "food", 900));
        assertThat(categories.existsById("fun")).isFalse();
    }

    @Test
    void categoriesArePrivateToTheirOwner() throws Exception {
        RequestPostProcessor other = user("user-2");
        categories.save(new Category("food-2", "user-2", "Alimente", TransactionType.EXPENSE, null, null));

        mvc.perform(get("/api/v1/categories").with(other))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value("food-2"));
        mvc.perform(post("/api/v1/transactions").with(other).contentType(MediaType.APPLICATION_JSON)
                        .content(transactionJson("EXPENSE", "10", "Not mine", "2026-09-10", "food")))
                .andExpect(status().isNotFound());
        mvc.perform(put("/api/v1/categories/food").with(other).contentType(MediaType.APPLICATION_JSON)
                        .content(categoryJson("Hijacked", "EXPENSE", null)))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/categories/food").with(other)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/categories/fun").param("replacementId", "food-2"))
                .andExpect(status().isNotFound());
        assertThat(categories.count()).isEqualTo(4);
    }

    private static String categoryJson(String name, String type, String color) {
        return color == null
                ? "{\"name\":\"%s\",\"type\":\"%s\"}".formatted(name, type)
                : "{\"name\":\"%s\",\"type\":\"%s\",\"color\":\"%s\"}".formatted(name, type, color);
    }

    @Test
    void transactionCrudLifecycle() throws Exception {
        String id = createTransaction("EXPENSE", "42.50", "Supermarket Mega", "2026-09-10", "food");

        mvc.perform(get("/api/v1/transactions/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(42.5))
                .andExpect(jsonPath("$.categoryName").value("Alimente"));

        mvc.perform(put("/api/v1/transactions/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content(transactionJson("EXPENSE", "99.99", "Supermarket updated", "2026-09-11", "food")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(99.99))
                .andExpect(jsonPath("$.description").value("Supermarket updated"));

        Document stored = mongoTemplate.getCollection("transactions").find().first();
        assertThat(stored).isNotNull();
        assertThat(stored.get("amount")).isInstanceOf(Decimal128.class);

        mvc.perform(delete("/api/v1/transactions/" + id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/transactions/" + id)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/transactions/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void transactionValidationRules() throws Exception {
        mvc.perform(post("/api/v1/transactions").contentType(MediaType.APPLICATION_JSON)
                        .content(transactionJson("EXPENSE", "10", "Wrong category type", "2026-09-10", "salary")))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(post("/api/v1/transactions").contentType(MediaType.APPLICATION_JSON)
                        .content(transactionJson("EXPENSE", "10", "Unknown category", "2026-09-10", "nope")))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/transactions").contentType(MediaType.APPLICATION_JSON)
                        .content(transactionJson("EXPENSE", "0", "Zero", "2026-09-10", "food")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.amount").exists());
    }

    @Test
    void transactionListSupportsFiltersPaginationAndSorting() throws Exception {
        createTransaction("INCOME", "5000", "Salariu septembrie", "2026-09-01", "salary");
        createTransaction("EXPENSE", "100", "Supermarket Mega", "2026-09-05", "food");
        createTransaction("EXPENSE", "250", "Supermarket Mega Image", "2026-09-15", "food");
        createTransaction("EXPENSE", "80", "Cinema", "2026-09-20", "fun");
        createTransaction("EXPENSE", "60", "Supermarket (promo)", "2026-10-02", "food");

        mvc.perform(get("/api/v1/transactions").param("page", "0").param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].description").value("Supermarket (promo)"))
                .andExpect(jsonPath("$.totalElements").value(5))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(2));

        mvc.perform(get("/api/v1/transactions").param("type", "EXPENSE").param("categoryId", "food")
                        .param("startDate", "2026-09-01").param("endDate", "2026-09-30").param("sort", "amount,desc"))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].amount").value(250.0))
                .andExpect(jsonPath("$.content[1].amount").value(100.0));

        mvc.perform(get("/api/v1/transactions").param("search", "supermarket").param("sort", "transactionDate,asc"))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[0].description").value("Supermarket Mega"));

        // regex metacharacters in the search text are treated literally
        mvc.perform(get("/api/v1/transactions").param("search", "(promo)"))
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/transactions").param("search", ".*"))
                .andExpect(jsonPath("$.totalElements").value(0));

        // inclusive date boundaries
        mvc.perform(get("/api/v1/transactions").param("startDate", "2026-09-05").param("endDate", "2026-09-05"))
                .andExpect(jsonPath("$.totalElements").value(1));

        mvc.perform(get("/api/v1/transactions").param("sort", "description,asc")).andExpect(status().isBadRequest());
    }

    @Test
    void dashboardComputesIndicatorsFromPersistedData() throws Exception {
        seedTransaction("salary", TransactionType.INCOME, "6000.00", "2026-09-01");
        seedTransaction("food", TransactionType.EXPENSE, "600.00", "2026-09-05");
        seedTransaction("food", TransactionType.EXPENSE, "300.00", "2026-09-28");
        seedTransaction("fun", TransactionType.EXPENSE, "800.00", "2026-09-30");
        // other months must not leak into September
        seedTransaction("food", TransactionType.EXPENSE, "5000.00", "2026-10-01");
        seedTransaction("salary", TransactionType.INCOME, "1000.00", "2026-08-31");
        seedBudget("food", "2026-09", "1000.00");

        mvc.perform(get("/api/v1/dashboard").param("month", "2026-09"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.month").value("2026-09"))
                .andExpect(jsonPath("$.totalIncome").value(6000.0))
                .andExpect(jsonPath("$.totalExpenses").value(1700.0))
                .andExpect(jsonPath("$.balance").value(4300.0))
                .andExpect(jsonPath("$.savingsRate").value(71.67))
                // only "food" has a budget: 900 spent of 1000, the 800 on "fun" is ignored
                .andExpect(jsonPath("$.budgetUsedPercentage").value(90.0))
                .andExpect(jsonPath("$.topCategories[0].categoryName").value("Alimente"))
                .andExpect(jsonPath("$.topCategories[0].amount").value(900.0))
                .andExpect(jsonPath("$.topCategories[0].percentage").value(52.94))
                .andExpect(jsonPath("$.monthlyTrend.length()").value(6))
                .andExpect(jsonPath("$.monthlyTrend[4].month").value("2026-08"))
                .andExpect(jsonPath("$.monthlyTrend[4].income").value(1000.0))
                .andExpect(jsonPath("$.recentTransactions[0].description").value("tx 2026-09-30"));
    }

    @Test
    void dashboardWithoutIncomeHasZeroSavingsRateAndZeroBudgetUsage() throws Exception {
        seedTransaction("food", TransactionType.EXPENSE, "200.00", "2026-09-05");

        mvc.perform(get("/api/v1/dashboard").param("month", "2026-09"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalIncome").value(0.0))
                .andExpect(jsonPath("$.balance").value(-200.0))
                .andExpect(jsonPath("$.savingsRate").value(0.0))
                .andExpect(jsonPath("$.budgetUsedPercentage").value(0.0));
    }

    @Test
    void budgetsEnforceUniquenessAndReportStatus() throws Exception {
        String body = "{\"categoryId\":\"food\",\"month\":\"2026-09\",\"limitAmount\":1000}";
        mvc.perform(post("/api/v1/budgets").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("NORMAL"));
        mvc.perform(post("/api/v1/budgets").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/v1/budgets").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":\"food\",\"month\":\"2026-10\",\"limitAmount\":500}"))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/budgets").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":\"salary\",\"month\":\"2026-09\",\"limitAmount\":500}"))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(post("/api/v1/budgets").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":\"fun\",\"month\":\"2026-9\",\"limitAmount\":500}"))
                .andExpect(status().isBadRequest());

        // the unique compound index is enforced by MongoDB itself, not only by the service check
        Budget duplicate = new Budget();
        duplicate.setUserId(TestUser.ID);
        duplicate.setCategoryId("food");
        duplicate.setMonth("2026-09");
        duplicate.setLimitAmount(BigDecimal.ONE);
        assertThatThrownBy(() -> budgets.save(duplicate)).isInstanceOf(DuplicateKeyException.class);

        seedTransaction("food", TransactionType.EXPENSE, "800.00", "2026-09-10");
        mvc.perform(get("/api/v1/budgets").param("month", "2026-09"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].categoryName").value("Alimente"))
                .andExpect(jsonPath("$[0].limitAmount").value(1000.0))
                .andExpect(jsonPath("$[0].spentAmount").value(800.0))
                .andExpect(jsonPath("$[0].remainingAmount").value(200.0))
                .andExpect(jsonPath("$[0].percentageUsed").value(80.0))
                .andExpect(jsonPath("$[0].status").value("WARNING"));

        seedTransaction("food", TransactionType.EXPENSE, "200.01", "2026-09-11");
        mvc.perform(get("/api/v1/budgets").param("month", "2026-09"))
                .andExpect(jsonPath("$[0].status").value("EXCEEDED"))
                .andExpect(jsonPath("$[0].remainingAmount").value(-0.01));
    }

    @Test
    void budgetIndexesExist() {
        assertThat(mongoTemplate.indexOps("budgets").getIndexInfo())
                .anyMatch(index -> index.isUnique() && index.getIndexFields().stream()
                        .map(f -> f.getKey()).toList().equals(List.of("userId", "month", "categoryId")));
        assertThat(mongoTemplate.indexOps("transactions").getIndexInfo())
                .flatExtracting(index -> index.getIndexFields().stream().map(f -> f.getKey()).toList())
                .contains("transactionDate", "categoryId", "type");
        assertThat(mongoTemplate.indexOps("goal_contributions").getIndexInfo())
                .anyMatch(index -> index.getIndexFields().stream().map(f -> f.getKey()).toList()
                        .equals(List.of("goalId", "contributionDate")));
    }

    @Test
    void goalContributionsAccumulateAndCompleteTheGoal() throws Exception {
        String goalId = createGoal("Laptop", "1000.00");
        mvc.perform(get("/api/v1/goals"))
                .andExpect(jsonPath("$[0].currentAmount").value(0.0))
                .andExpect(jsonPath("$[0].status").value("ACTIVE"));

        mvc.perform(post("/api/v1/goals/" + goalId + "/contributions").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":400.50,\"note\":\"prima\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.currentAmount").value(400.5))
                .andExpect(jsonPath("$.progressPercentage").value(40.05))
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        mvc.perform(post("/api/v1/goals/" + goalId + "/contributions").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":599.50}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.currentAmount").value(1000.0))
                .andExpect(jsonPath("$.progressPercentage").value(100.0))
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        mvc.perform(post("/api/v1/goals/" + goalId + "/contributions").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":1}"))
                .andExpect(status().isConflict());
        assertThat(contributions.count()).isEqualTo(2);

        mvc.perform(get("/api/v1/goals"))
                .andExpect(jsonPath("$[0].status").value("COMPLETED"))
                .andExpect(jsonPath("$[0].currentAmount").value(1000.0));

        mvc.perform(post("/api/v1/goals/unknown/contributions").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":1}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/goals/" + goalId + "/contributions").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":-1}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void goalCreationValidatesInput() throws Exception {
        mvc.perform(post("/api/v1/goals").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"targetAmount\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.name").exists())
                .andExpect(jsonPath("$.fieldErrors.targetAmount").exists());
        mvc.perform(post("/api/v1/goals").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Old\",\"targetAmount\":100,\"targetDate\":\"2020-01-01\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aiInsightsUseServerSideFiguresAndIgnoreClientTotals() throws Exception {
        seedTransaction("salary", TransactionType.INCOME, "4000.00", "2026-09-01");
        seedTransaction("food", TransactionType.EXPENSE, "1000.00", "2026-09-05");
        when(ai.analyze(any())).thenReturn(new AiAnalysis("Rezumat", List.of(
                new AiAnalysis.Insight("Titlu", "Motiv", new BigDecimal("100.00"), AiAnalysis.Priority.MEDIUM))));

        mvc.perform(post("/api/v1/ai/insights").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"month\":\"2026-09\",\"totalIncome\":1,\"totalExpenses\":999999}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.month").value("2026-09"))
                .andExpect(jsonPath("$.summary").value("Rezumat"))
                .andExpect(jsonPath("$.insights[0].priority").value("MEDIUM"));

        ArgumentCaptor<FinancialSummary> captor = ArgumentCaptor.forClass(FinancialSummary.class);
        Mockito.verify(ai).analyze(captor.capture());
        assertThat(captor.getValue().totalIncome()).isEqualByComparingTo("4000.00");
        assertThat(captor.getValue().totalExpenses()).isEqualByComparingTo("1000.00");
        assertThat(captor.getValue().savingsRate()).isEqualByComparingTo("75.00");
    }

    @Test
    void aiFailureIsReturnedAsControlledError() throws Exception {
        seedTransaction("food", TransactionType.EXPENSE, "1000.00", "2026-09-05");
        when(ai.analyze(any())).thenThrow(new ApiException(HttpStatus.GATEWAY_TIMEOUT, "Furnizorul AI nu a răspuns la timp."));

        mvc.perform(post("/api/v1/ai/insights").contentType(MediaType.APPLICATION_JSON).content("{\"month\":\"2026-09\"}"))
                .andExpect(status().isGatewayTimeout())
                .andExpect(jsonPath("$.message").value("Furnizorul AI nu a răspuns la timp."));
    }

    @Test
    void aiIsNotCalledWhenTheMonthHasNoData() throws Exception {
        mvc.perform(post("/api/v1/ai/insights").contentType(MediaType.APPLICATION_JSON).content("{\"month\":\"2020-01\"}"))
                .andExpect(status().isUnprocessableEntity());
        verifyNoInteractions(ai);
    }

    @Test
    void demoSeederIsIdempotentAndProducesAllBudgetStatuses() throws Exception {
        categories.deleteAll();
        DemoDataSeeder seeder = new DemoDataSeeder(new DefaultCategories(categories), transactions, budgets, goals,
                contributions, TestClock.FIXED, TestUser.ID);

        seeder.run(null);
        long[] first = counts();
        seeder.run(null);
        assertThat(counts()).containsExactly(first);
        assertThat(first[0]).isEqualTo(11);
        assertThat(first[1]).isGreaterThan(40);
        assertThat(first[3]).isGreaterThanOrEqualTo(2);

        MvcResult result = mvc.perform(get("/api/v1/budgets").param("month", "2026-10")).andExpect(status().isOk()).andReturn();
        JsonNode body = json.readTree(result.getResponse().getContentAsString());
        List<String> statuses = body.findValuesAsText("status");
        assertThat(statuses).contains("NORMAL", "WARNING", "EXCEEDED");

        mvc.perform(get("/api/v1/dashboard").param("month", "2026-10"))
                .andExpect(jsonPath("$.totalIncome").value(7700.0))
                .andExpect(jsonPath("$.goals.length()").value(4));
    }

    @Test
    void newUsersGetTheStarterCategoriesOnlyOnce() throws Exception {
        DefaultCategories defaults = new DefaultCategories(categories);

        defaults.createIfNone("user-2");
        assertThat(categories.findByUserId("user-2", org.springframework.data.domain.Sort.unsorted())).hasSize(11);
        String bonusId = categories.findByUserIdAndNameAndType("user-2", "Bonusuri", TransactionType.INCOME)
                .orElseThrow().getId();
        categories.deleteById(bonusId);
        defaults.createIfNone("user-2");
        assertThat(categories.countByUserId("user-2")).isEqualTo(10);
        assertThat(categories.countByUserId(TestUser.ID)).isEqualTo(3);
    }

    @Test
    void sharedCategoriesAreCopiedToEveryUserAndTheirDataIsRepointed() throws Exception {
        categories.deleteAll();
        mongoTemplate.getCollection("categories").insertOne(new Document("_id", "shared-food")
                .append("name", "Alimente").append("type", "EXPENSE").append("color", "#4f46e5"));
        mongoTemplate.getCollection("categories").insertOne(new Document("_id", "shared-salary")
                .append("name", "Salariu").append("type", "INCOME"));
        seedTransaction("shared-food", TransactionType.EXPENSE, "50.00", "2026-09-05");
        seedBudget("shared-food", "2026-09", "500");
        Transaction otherTx = new Transaction();
        otherTx.setUserId("user-2");
        otherTx.setType(TransactionType.INCOME);
        otherTx.setAmount(new BigDecimal("100.00"));
        otherTx.setDescription("Salariu");
        otherTx.setTransactionDate(LocalDate.parse("2026-09-01"));
        otherTx.setCategoryId("shared-salary");
        transactions.save(otherTx);
        CategoryOwnershipMigration migration = new CategoryOwnershipMigration(mongoTemplate, categories);

        migration.run(null);
        migration.run(null);

        assertThat(categories.existsById("shared-food")).isFalse();
        assertThat(categories.countByUserId(TestUser.ID)).isEqualTo(2);
        assertThat(categories.countByUserId("user-2")).isEqualTo(2);
        String myFood = categories.findByUserIdAndNameAndType(TestUser.ID, "Alimente", TransactionType.EXPENSE)
                .orElseThrow().getId();
        String theirSalary = categories.findByUserIdAndNameAndType("user-2", "Salariu", TransactionType.INCOME)
                .orElseThrow().getId();
        assertThat(transactions.findAll()).extracting(Transaction::getCategoryId)
                .containsExactlyInAnyOrder(myFood, theirSalary);
        assertThat(budgets.findAll()).extracting(Budget::getCategoryId).containsExactly(myFood);
        mvc.perform(get("/api/v1/dashboard").param("month", "2026-09"))
                .andExpect(jsonPath("$.totalExpenses").value(50.0));
    }

    private long[] counts() {
        return new long[]{categories.count(), transactions.count(), budgets.count(), goals.count(), contributions.count()};
    }

    private String createTransaction(String type, String amount, String description, String date, String categoryId)
            throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/transactions").contentType(MediaType.APPLICATION_JSON)
                        .content(transactionJson(type, amount, description, date, categoryId)))
                .andExpect(status().isCreated())
                .andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("id").asText();
    }

    private String createGoal(String name, String target) throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/goals").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\",\"targetAmount\":" + target + ",\"targetDate\":\"2027-12-31\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("id").asText();
    }

    private static String transactionJson(String type, String amount, String description, String date, String categoryId) {
        return "{\"type\":\"%s\",\"amount\":%s,\"description\":\"%s\",\"transactionDate\":\"%s\",\"categoryId\":\"%s\"}"
                .formatted(type, amount, description, date, categoryId);
    }

    private void seedTransaction(String categoryId, TransactionType type, String amount, String date) {
        Transaction tx = new Transaction();
        tx.setUserId(TestUser.ID);
        tx.setType(type);
        tx.setAmount(new BigDecimal(amount));
        tx.setDescription("tx " + date);
        tx.setTransactionDate(LocalDate.parse(date));
        tx.setCategoryId(categoryId);
        tx.setCreatedAt(Instant.parse(date + "T00:00:00Z"));
        tx.setUpdatedAt(tx.getCreatedAt());
        transactions.save(tx);
    }

    private void seedBudget(String categoryId, String month, String limit) {
        Budget budget = new Budget();
        budget.setUserId(TestUser.ID);
        budget.setCategoryId(categoryId);
        budget.setMonth(month);
        budget.setLimitAmount(new BigDecimal(limit));
        budgets.save(budget);
    }

    @Test
    void endpointsRequireAuthenticationButHealthAndSignInArePublic() throws Exception {
        mvc.perform(get("/api/v1/transactions").with(anonymous()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
        mvc.perform(get("/api/v1/categories").with(anonymous())).andExpect(status().isUnauthorized());
        mvc.perform(get("/actuator/health").with(anonymous())).andExpect(status().isOk());
        // no Google client id is configured in tests: sign-in is reachable but reports it is unavailable
        mvc.perform(post("/api/v1/auth/google").with(anonymous()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"credential\":\"x\"}"))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void usersOnlySeeAndChangeTheirOwnData() throws Exception {
        String txId = createTransaction("EXPENSE", "42.50", "Mine", "2026-09-10", "food");
        String goalId = createGoal("Laptop", "1000.00");
        mvc.perform(post("/api/v1/budgets").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":\"food\",\"month\":\"2026-09\",\"limitAmount\":1000}"))
                .andExpect(status().isCreated());

        RequestPostProcessor other = user("user-2");
        mvc.perform(get("/api/v1/transactions").with(other))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/transactions/" + txId).with(other)).andExpect(status().isNotFound());
        mvc.perform(put("/api/v1/transactions/" + txId).with(other).contentType(MediaType.APPLICATION_JSON)
                        .content(transactionJson("EXPENSE", "1", "Hijacked", "2026-09-10", "food")))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/transactions/" + txId).with(other)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/goals").with(other)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(post("/api/v1/goals/" + goalId + "/contributions").with(other)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":10}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/budgets").with(other).param("month", "2026-09"))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/v1/dashboard").with(other).param("month", "2026-09"))
                .andExpect(jsonPath("$.totalExpenses").value(0.0));

        // the same budget (category name + month) is allowed for another user, on their own category
        categories.save(new Category("food-2", "user-2", "Alimente", TransactionType.EXPENSE, null, null));
        mvc.perform(post("/api/v1/budgets").with(other).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":\"food\",\"month\":\"2026-09\",\"limitAmount\":300}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/budgets").with(other).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":\"food-2\",\"month\":\"2026-09\",\"limitAmount\":300}"))
                .andExpect(status().isCreated());

        // the owner still has everything
        mvc.perform(get("/api/v1/transactions/" + txId)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/budgets").param("month", "2026-09"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].limitAmount").value(1000.0));
    }
}
