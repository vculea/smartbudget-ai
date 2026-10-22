package com.smartbudget.config;

import com.smartbudget.budget.Budget;
import com.smartbudget.budget.BudgetRepository;
import com.smartbudget.category.Category;
import com.smartbudget.category.CategoryRepository;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Populates the reference categories and, when smartbudget.seed.user-id is set, demo data (last 3 months) owned by
 * that user (the internal user id, see the users collection). Every document has a deterministic id and is only
 * inserted when missing, so restarting the application never duplicates or overwrites data.
 * Enabled with smartbudget.seed.enabled=true (default only in the dev profile).
 */
@Component
@ConditionalOnProperty(name = "smartbudget.seed.enabled", havingValue = "true")
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    private record Cat(String id, String name, TransactionType type, String color, String icon) {
    }

    /** Expense template for the current month; previous months are scaled (rent and utilities are fixed). */
    private record Spend(String categoryId, int day, String amount, String description, boolean scalable) {
    }

    private static final List<Cat> CATEGORIES = List.of(
            new Cat("demo-cat-salary", "Salariu", TransactionType.INCOME, "#10b981", "briefcase"),
            new Cat("demo-cat-freelance", "Freelance", TransactionType.INCOME, "#14b8a6", "laptop"),
            new Cat("demo-cat-bonus", "Bonusuri", TransactionType.INCOME, "#84cc16", "gift"),
            new Cat("demo-cat-groceries", "Alimente", TransactionType.EXPENSE, "#4f46e5", "shopping-cart"),
            new Cat("demo-cat-transport", "Transport", TransactionType.EXPENSE, "#0ea5e9", "car"),
            new Cat("demo-cat-rent", "Chirie", TransactionType.EXPENSE, "#7c3aed", "home"),
            new Cat("demo-cat-utilities", "Utilități", TransactionType.EXPENSE, "#f59e0b", "zap"),
            new Cat("demo-cat-entertainment", "Divertisment", TransactionType.EXPENSE, "#ec4899", "film"),
            new Cat("demo-cat-restaurants", "Restaurante", TransactionType.EXPENSE, "#f97316", "utensils"),
            new Cat("demo-cat-health", "Sănătate", TransactionType.EXPENSE, "#ef4444", "heart-pulse"),
            new Cat("demo-cat-shopping", "Cumpărături", TransactionType.EXPENSE, "#a855f7", "shopping-bag"));

    private static final List<Spend> EXPENSES = List.of(
            new Spend("demo-cat-rent", 1, "1800.00", "Chirie apartament", false),
            new Spend("demo-cat-utilities", 5, "420.00", "Facturi utilități", false),
            new Spend("demo-cat-groceries", 3, "210.00", "Supermarket", true),
            new Spend("demo-cat-groceries", 8, "185.00", "Piață și băcănie", true),
            new Spend("demo-cat-groceries", 13, "240.00", "Cumpărături săptămânale", true),
            new Spend("demo-cat-groceries", 19, "160.00", "Supermarket", true),
            new Spend("demo-cat-groceries", 25, "205.00", "Cumpărături săptămânale", true),
            new Spend("demo-cat-transport", 2, "120.00", "Abonament transport și combustibil", true),
            new Spend("demo-cat-transport", 12, "110.00", "Combustibil", true),
            new Spend("demo-cat-transport", 21, "100.00", "Taxi și parcare", true),
            new Spend("demo-cat-entertainment", 6, "150.00", "Cinema și concert", true),
            new Spend("demo-cat-entertainment", 15, "135.00", "Abonamente streaming și jocuri", true),
            new Spend("demo-cat-entertainment", 23, "100.00", "Ieșire cu prietenii", true),
            new Spend("demo-cat-restaurants", 9, "130.00", "Cină la restaurant", true),
            new Spend("demo-cat-restaurants", 20, "120.00", "Prânz de echipă", true),
            new Spend("demo-cat-health", 11, "180.00", "Farmacie și consultație", true),
            new Spend("demo-cat-shopping", 17, "320.00", "Haine", true));

    /** categoryId -> monthly limit, defined for 3 months to show NORMAL, WARNING and EXCEEDED. */
    private static final List<String[]> BUDGETS = List.of(
            new String[]{"demo-cat-groceries", "1500.00"},
            new String[]{"demo-cat-transport", "400.00"},
            new String[]{"demo-cat-rent", "1800.00"},
            new String[]{"demo-cat-utilities", "600.00"},
            new String[]{"demo-cat-entertainment", "300.00"},
            new String[]{"demo-cat-restaurants", "500.00"});

    private final CategoryRepository categories;
    private final TransactionRepository transactions;
    private final BudgetRepository budgets;
    private final SavingsGoalRepository goals;
    private final GoalContributionRepository contributions;
    private final Clock clock;
    private final String userId;

    public DemoDataSeeder(CategoryRepository categories, TransactionRepository transactions,
                          BudgetRepository budgets, SavingsGoalRepository goals,
                          GoalContributionRepository contributions, Clock clock,
                          @Value("${smartbudget.seed.user-id:}") String userId) {
        this.categories = categories;
        this.transactions = transactions;
        this.budgets = budgets;
        this.goals = goals;
        this.contributions = contributions;
        this.clock = clock;
        this.userId = userId.strip();
    }

    @Override
    public void run(ApplicationArguments args) {
        LocalDate today = LocalDate.now(clock);
        int created = 0;
        created += seedCategories();
        if (userId.isEmpty()) {
            log.info("Demo data seeding: {} new categories (set SEED_USER_ID to also seed demo data for a user)",
                    created);
            return;
        }
        for (int offset = 2; offset >= 0; offset--) {
            YearMonth month = YearMonth.from(today).minusMonths(offset);
            created += seedTransactions(month, today, offset);
            created += seedBudgets(month);
        }
        created += seedGoals(today);
        log.info("Demo data seeding finished ({} new documents)", created);
    }

    /** Reference categories shared with {@link DefaultCategoriesInitializer}; ids are deterministic. */
    public static List<Category> defaultCategories() {
        return CATEGORIES.stream()
                .map(c -> new Category(c.id(), c.name(), c.type(), c.color(), c.icon()))
                .toList();
    }

    private int seedCategories() {
        int created = 0;
        for (Cat c : CATEGORIES) {
            if (!categories.existsById(c.id())) {
                categories.save(new Category(c.id(), c.name(), c.type(), c.color(), c.icon()));
                created++;
            }
        }
        return created;
    }

    private int seedTransactions(YearMonth month, LocalDate today, int monthsAgo) {
        BigDecimal factor = switch (monthsAgo) {
            case 1 -> new BigDecimal("0.92");
            case 2 -> new BigDecimal("1.05");
            default -> BigDecimal.ONE;
        };
        int created = 0;
        int index = 0;
        created += saveTransaction(month, today, index++, TransactionType.INCOME, "demo-cat-salary", 1,
                new BigDecimal("6500.00"), "Salariu lunar");
        if (monthsAgo <= 1) {
            created += saveTransaction(month, today, index++, TransactionType.INCOME, "demo-cat-freelance", 15,
                    new BigDecimal("1200.00"), "Proiect freelance");
        } else {
            created += saveTransaction(month, today, index++, TransactionType.INCOME, "demo-cat-bonus", 10,
                    new BigDecimal("500.00"), "Bonus de performanță");
        }
        for (Spend spend : EXPENSES) {
            BigDecimal amount = new BigDecimal(spend.amount());
            if (spend.scalable()) {
                amount = amount.multiply(factor).setScale(2, RoundingMode.HALF_UP);
            }
            created += saveTransaction(month, today, index++, TransactionType.EXPENSE, spend.categoryId(),
                    spend.day(), amount, spend.description());
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

    private int seedBudgets(YearMonth month) {
        int created = 0;
        for (String[] entry : BUDGETS) {
            String id = "demo-budget-" + month + "-" + entry[0].substring("demo-cat-".length());
            if (budgets.existsById(id)) {
                continue;
            }
            Budget budget = new Budget();
            budget.setId(id);
            budget.setUserId(userId);
            budget.setCategoryId(entry[0]);
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
