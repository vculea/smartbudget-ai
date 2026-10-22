package com.smartbudget.config;

import com.smartbudget.budget.Budget;
import com.smartbudget.budget.BudgetRepository;
import com.smartbudget.category.DefaultCategories;
import com.smartbudget.goal.GoalContribution;
import com.smartbudget.goal.GoalContributionRepository;
import com.smartbudget.goal.GoalStatus;
import com.smartbudget.goal.SavingsGoal;
import com.smartbudget.goal.SavingsGoalRepository;
import com.smartbudget.transaction.Transaction;
import com.smartbudget.transaction.TransactionRepository;
import com.smartbudget.transaction.TransactionType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * When smartbudget.seed.user-id is set, creates demo data (last 3 months) owned by that user (the internal user id,
 * see the users collection), including the starter categories when the user does not have them. Transactions,
 * budgets and goals have deterministic ids and are only inserted when missing, so restarting the application never
 * duplicates or overwrites data. Enabled with smartbudget.seed.enabled=true (default only in the dev profile).
 */
@Component
@ConditionalOnProperty(name = "smartbudget.seed.enabled", havingValue = "true")
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    /** Expense template for the current month (category = {@link DefaultCategories} template key); previous months
     * are scaled (rent and utilities are fixed). */
    private record Spend(String category, int day, String amount, String description, boolean scalable) {
    }

    private static final List<Spend> EXPENSES = List.of(
            new Spend("rent", 1, "1800.00", "Chirie apartament", false),
            new Spend("utilities", 5, "420.00", "Facturi utilități", false),
            new Spend("groceries", 3, "210.00", "Supermarket", true),
            new Spend("groceries", 8, "185.00", "Piață și băcănie", true),
            new Spend("groceries", 13, "240.00", "Cumpărături săptămânale", true),
            new Spend("groceries", 19, "160.00", "Supermarket", true),
            new Spend("groceries", 25, "205.00", "Cumpărături săptămânale", true),
            new Spend("transport", 2, "120.00", "Abonament transport și combustibil", true),
            new Spend("transport", 12, "110.00", "Combustibil", true),
            new Spend("transport", 21, "100.00", "Taxi și parcare", true),
            new Spend("entertainment", 6, "150.00", "Cinema și concert", true),
            new Spend("entertainment", 15, "135.00", "Abonamente streaming și jocuri", true),
            new Spend("entertainment", 23, "100.00", "Ieșire cu prietenii", true),
            new Spend("restaurants", 9, "130.00", "Cină la restaurant", true),
            new Spend("restaurants", 20, "120.00", "Prânz de echipă", true),
            new Spend("health", 11, "180.00", "Farmacie și consultație", true),
            new Spend("shopping", 17, "320.00", "Haine", true));

    /** category template key -> monthly limit, defined for 3 months to show NORMAL, WARNING and EXCEEDED. */
    private static final List<String[]> BUDGETS = List.of(
            new String[]{"groceries", "1500.00"},
            new String[]{"transport", "400.00"},
            new String[]{"rent", "1800.00"},
            new String[]{"utilities", "600.00"},
            new String[]{"entertainment", "300.00"},
            new String[]{"restaurants", "500.00"});

    private final DefaultCategories defaultCategories;
    private final TransactionRepository transactions;
    private final BudgetRepository budgets;
    private final SavingsGoalRepository goals;
    private final GoalContributionRepository contributions;
    private final Clock clock;
    private final String userId;

    public DemoDataSeeder(DefaultCategories defaultCategories, TransactionRepository transactions,
                          BudgetRepository budgets, SavingsGoalRepository goals,
                          GoalContributionRepository contributions, Clock clock,
                          @Value("${smartbudget.seed.user-id:}") String userId) {
        this.defaultCategories = defaultCategories;
        this.transactions = transactions;
        this.budgets = budgets;
        this.goals = goals;
        this.contributions = contributions;
        this.clock = clock;
        this.userId = userId.strip();
    }

    @Override
    public void run(ApplicationArguments args) {
        if (userId.isEmpty()) {
            log.info("Demo data seeding skipped: set SEED_USER_ID to seed demo data for a user");
            return;
        }
        LocalDate today = LocalDate.now(clock);
        Map<String, String> categoryIds = defaultCategories.ensure(userId);
        int created = 0;
        for (int offset = 2; offset >= 0; offset--) {
            YearMonth month = YearMonth.from(today).minusMonths(offset);
            created += seedTransactions(categoryIds, month, today, offset);
            created += seedBudgets(categoryIds, month);
        }
        created += seedGoals(today);
        log.info("Demo data seeding finished ({} new documents)", created);
    }

    private int seedTransactions(Map<String, String> categoryIds, YearMonth month, LocalDate today, int monthsAgo) {
        BigDecimal factor = switch (monthsAgo) {
            case 1 -> new BigDecimal("0.92");
            case 2 -> new BigDecimal("1.05");
            default -> BigDecimal.ONE;
        };
        int created = 0;
        int index = 0;
        created += saveTransaction(month, today, index++, TransactionType.INCOME, categoryIds.get("salary"), 1,
                new BigDecimal("6500.00"), "Salariu lunar");
        if (monthsAgo <= 1) {
            created += saveTransaction(month, today, index++, TransactionType.INCOME, categoryIds.get("freelance"), 15,
                    new BigDecimal("1200.00"), "Proiect freelance");
        } else {
            created += saveTransaction(month, today, index++, TransactionType.INCOME, categoryIds.get("bonus"), 10,
                    new BigDecimal("500.00"), "Bonus de performanță");
        }
        for (Spend spend : EXPENSES) {
            BigDecimal amount = new BigDecimal(spend.amount());
            if (spend.scalable()) {
                amount = amount.multiply(factor).setScale(2, RoundingMode.HALF_UP);
            }
            created += saveTransaction(month, today, index++, TransactionType.EXPENSE,
                    categoryIds.get(spend.category()), spend.day(), amount, spend.description());
        }
        return created;
    }

    private int saveTransaction(YearMonth month, LocalDate today, int index, TransactionType type, String categoryId,
                                int day, BigDecimal amount, String description) {
        String id = "demo-tx-" + month + "-" + String.format("%02d", index);
        if (transactions.existsById(id)) {
            return 0;
        }
        // Keep demo dates in the past: only the dates move, never the amounts
        LocalDate date = month.atDay(Math.min(day, month.lengthOfMonth()));
        if (date.isAfter(today)) {
            date = today;
        }
        Instant stamp = date.atStartOfDay().toInstant(ZoneOffset.UTC).plusSeconds(index);
        Transaction tx = new Transaction();
        tx.setId(id);
        tx.setUserId(userId);
        tx.setType(type);
        tx.setAmount(amount);
        tx.setDescription(description);
        tx.setTransactionDate(date);
        tx.setCategoryId(categoryId);
        tx.setCreatedAt(stamp);
        tx.setUpdatedAt(stamp);
        transactions.save(tx);
        return 1;
    }

    private int seedBudgets(Map<String, String> categoryIds, YearMonth month) {
        int created = 0;
        for (String[] entry : BUDGETS) {
            String id = "demo-budget-" + month + "-" + entry[0];
            if (budgets.existsById(id)) {
                continue;
            }
            Budget budget = new Budget();
            budget.setId(id);
            budget.setUserId(userId);
            budget.setCategoryId(categoryIds.get(entry[0]));
            budget.setMonth(month.toString());
            budget.setLimitAmount(new BigDecimal(entry[1]));
            budget.setCreatedAt(clock.instant());
            budget.setUpdatedAt(clock.instant());
            budgets.save(budget);
            created++;
        }
        return created;
    }

    private int seedGoals(LocalDate today) {
        int created = 0;
        created += seedGoal("demo-goal-emergency", "Fond de urgență", "Șase luni de cheltuieli esențiale",
                "10000.00", today.plusMonths(12), GoalStatus.ACTIVE, today,
                new String[]{"1500.00", "1000.00", "1000.00"}, new int[]{75, 45, 15});
        created += seedGoal("demo-goal-laptop", "Laptop nou", "Înlocuirea laptopului de lucru",
                "5000.00", today.plusMonths(6), GoalStatus.ACTIVE, today,
                new String[]{"1200.00", "800.00"}, new int[]{50, 20});
        created += seedGoal("demo-goal-vacation", "Vacanță de vară", null,
                "3000.00", today.plusMonths(4), GoalStatus.ACTIVE, today,
                new String[]{"500.00", "400.00"}, new int[]{40, 10});
        created += seedGoal("demo-goal-bike", "Bicicletă", "Obiectiv atins",
                "1500.00", today.plusMonths(1), GoalStatus.COMPLETED, today,
                new String[]{"800.00", "700.00"}, new int[]{60, 25});
        return created;
    }

    private int seedGoal(String id, String name, String description, String target, LocalDate targetDate,
                         GoalStatus status, LocalDate today, String[] amounts, int[] daysAgo) {
        int created = 0;
        Instant now = clock.instant();
        if (!goals.existsById(id)) {
            SavingsGoal goal = new SavingsGoal();
            goal.setId(id);
            goal.setUserId(userId);
            goal.setName(name);
            goal.setDescription(description);
            goal.setTargetAmount(new BigDecimal(target));
            goal.setTargetDate(targetDate);
            goal.setStatus(status);
            goal.setCreatedAt(now);
            goal.setUpdatedAt(now);
            goals.save(goal);
            created++;
        }
        for (int i = 0; i < amounts.length; i++) {
            String contributionId = id.replace("demo-goal-", "demo-contrib-") + "-" + i;
            if (contributions.existsById(contributionId)) {
                continue;
            }
            GoalContribution contribution = new GoalContribution();
            contribution.setId(contributionId);
            contribution.setGoalId(id);
            contribution.setAmount(new BigDecimal(amounts[i]));
            contribution.setContributionDate(today.minusDays(daysAgo[i]));
            contribution.setNote(i == 0 ? "Economii lunare" : null);
            contribution.setCreatedAt(now);
            contributions.save(contribution);
            created++;
        }
        return created;
    }
}
