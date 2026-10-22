package com.smartbudget.transaction;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import org.bson.Document;
import org.bson.types.Decimal128;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

/** MongoDB aggregations over transactions (sums are computed in the database). */
@Service
public class TransactionStatsService {

    public record PeriodTotals(BigDecimal income, BigDecimal expenses) {
    }

    private final MongoTemplate mongoTemplate;

    public TransactionStatsService(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    /** Totals for dates in [from, to] (both inclusive). */
    public PeriodTotals totals(LocalDate from, LocalDate to) {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("transactionDate").gte(from).lte(to)),
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
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("transactionDate").gte(from).lte(to)
                        .and("type").is(TransactionType.EXPENSE)),
                Aggregation.group("categoryId").sum("amount").as("total"));
        Map<String, BigDecimal> result = new HashMap<>();
        for (Document doc : mongoTemplate.aggregate(aggregation, Transaction.class, Document.class)) {
            result.put(doc.getString("_id"), toBigDecimal(doc.get("total")));
        }
        return result;
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
