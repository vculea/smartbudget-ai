package com.smartbudget.goal;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import org.bson.Document;
import org.bson.types.Decimal128;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface GoalContributionRepository extends MongoRepository<GoalContribution, String>,
        GoalContributionRepositoryCustom {
}

interface GoalContributionRepositoryCustom {

    /** Sum of contributions per goal id, computed by MongoDB. Goals without contributions are absent. */
    Map<String, BigDecimal> sumByGoalIds(Collection<String> goalIds);
}

class GoalContributionRepositoryCustomImpl implements GoalContributionRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    GoalContributionRepositoryCustomImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public Map<String, BigDecimal> sumByGoalIds(Collection<String> goalIds) {
        Map<String, BigDecimal> result = new HashMap<>();
        if (goalIds.isEmpty()) {
            return result;
        }
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("goalId").in(goalIds)),
                Aggregation.group("goalId").sum("amount").as("total"));
        for (Document doc : mongoTemplate.aggregate(aggregation, GoalContribution.class, Document.class)) {
            Object total = doc.get("total");
            BigDecimal value = total instanceof Decimal128 d ? d.bigDecimalValue() : new BigDecimal(String.valueOf(total));
            result.put(doc.getString("_id"), value);
        }
        return result;
    }
}
