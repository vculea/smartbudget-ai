package com.smartbudget.transaction;

import com.smartbudget.auth.CurrentUser;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.bson.Document;
import org.bson.types.Decimal128;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

/** MongoDB aggregations over transactions (sums are computed in the database). */
@Service
public class TransactionStatsService {

    public record PeriodTotals(BigDecimal income, BigDecimal expenses) {
    }

    private final MongoTemplate mongoTemplate;
    private final CurrentUser currentUser;

    public TransactionStatsService(MongoTemplate mongoTemplate, CurrentUser currentUser) {
        this.mongoTemplate = mongoTemplate;
        this.currentUser = currentUser;
    }

    /** Totals for dates in [from, to] (both inclusive). */
    public PeriodTotals totals(LocalDate from, LocalDate to) {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("userId").is(currentUser.id()).and("transactionDate").gte(from).lte(to)),
                Aggregation.group("type").sum("amount").as("total"));
        BigDecimal income = BigDecimal.ZERO;
        BigDecimal expenses = BigDecimal.ZERO;
        for (Document doc : mongoTemplate.aggregate(aggregation, Transaction.class, Document.class)) {
            BigDecimal total = toBigDecimal(doc.get("total"));
            if (TransactionType.INCOME.name().equals(doc.getString("_id"))) {
                income = total;
            } else if (TransactionType.EXPENSE.name().equals(doc.getString("_id"))) {
                expenses = total;
            }
        }
        return new PeriodTotals(income, expenses);
    }

    /** Expense totals per category id for dates in [from, to]. */
    public Map<String, BigDecimal> expensesByCategory(LocalDate from, LocalDate to) {
        return totalsByCategory(TransactionType.EXPENSE, from, to);
    }

    /** Income totals per category id for dates in [from, to]. */
    public Map<String, BigDecimal> incomesByCategory(LocalDate from, LocalDate to) {
        return totalsByCategory(TransactionType.INCOME, from, to);
    }

    private Map<String, BigDecimal> totalsByCategory(TransactionType type, LocalDate from, LocalDate to) {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("userId").is(currentUser.id())
                        .and("transactionDate").gte(from).lte(to)
                        .and("type").is(type)),
                Aggregation.group("categoryId").sum("amount").as("total"));
        Map<String, BigDecimal> result = new HashMap<>();
        for (Document doc : mongoTemplate.aggregate(aggregation, Transaction.class, Document.class)) {
            result.put(doc.getString("_id"), toBigDecimal(doc.get("total")));
        }
        return result;
    }

    /** Date of the user's oldest transaction, if any. */
    public Optional<LocalDate> firstTransactionDate() {
        Query query = Query.query(Criteria.where("userId").is(currentUser.id()))
                .with(Sort.by(Sort.Direction.ASC, "transactionDate"))
                .limit(1);
        query.fields().include("transactionDate");
        return Optional.ofNullable(mongoTemplate.findOne(query, Transaction.class))
                .map(Transaction::getTransactionDate);
    }

    static BigDecimal toBigDecimal(Object value) {
        if (value instanceof Decimal128 decimal) {
            return decimal.bigDecimalValue();
        }
        if (value instanceof Number number) {
            return new BigDecimal(number.toString());
        }
        return BigDecimal.ZERO;
    }
}
