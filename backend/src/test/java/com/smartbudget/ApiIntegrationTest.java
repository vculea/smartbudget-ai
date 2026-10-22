package com.smartbudget;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
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
import com.smartbudget.common.ApiException;
import com.smartbudget.config.DefaultCategoriesInitializer;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** End-to-end API tests on a real, isolated MongoDB (Testcontainers). Skipped when Docker is unavailable. */
@SpringBootTest
@AutoConfigureMockMvc
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
        categories.save(new Category("salary", "Salariu", TransactionType.INCOME, "#10b981", "briefcase"));
        categories.save(new Category("food", "Alimente", TransactionType.EXPENSE, "#4f46e5", "cart"));
        categories.save(new Category("fun", "Divertisment", TransactionType.EXPENSE, "#ec4899", "film"));
    }

    @Test
    void categoriesEndpointListsAvailableCategories() throws Exception {
        mvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[?(@.id=='food')].name").value("Alimente"));
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
                        .map(f -> f.getKey()).toList().equals(List.of("month", "categoryId")));
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
        DemoDataSeeder seeder = new DemoDataSeeder(categories, transactions, budgets, goals, contributions, TestClock.FIXED);

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
    void defaultCategoriesAreInsertedOnlyIntoAnEmptyCollection() throws Exception {
        categories.deleteAll();
        DefaultCategoriesInitializer initializer = new DefaultCategoriesInitializer(categories);

        initializer.run(null);
        assertThat(categories.count()).isEqualTo(11);

        categories.deleteById("demo-cat-bonus");
        initializer.run(null);
        assertThat(categories.count()).isEqualTo(10);

        mvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(10));
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
        budget.setCategoryId(categoryId);
        budget.setMonth(month);
        budget.setLimitAmount(new BigDecimal(limit));
        budgets.save(budget);
    }
}
