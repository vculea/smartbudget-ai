package com.smartbudget.category;

import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

import com.smartbudget.auth.CurrentUser;
import com.smartbudget.transaction.TransactionType;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * Remembers which category the user chose for each merchant, so the next import fills it in without asking the AI,
 * and the AI gets the user's habits as examples for merchants it has not seen yet.
 * <p>
 * A merchant gets a category only when that category clearly dominates ({@link #DOMINANT_SHARE}) the user's choices
 * for it: first by its exact {@link MerchantKey}, then by the keys sharing its first word ("kaufland cluj" helps
 * "kaufland brasov"). A correction replaces what was remembered for the key, so the latest correction wins.
 */
@Service
public class CategoryMemoryService {

    static final double DOMINANT_SHARE = 0.8;
    static final int MAX_EXAMPLES = 30;
    private static final int EXAMPLE_SCAN_LIMIT = 2000;

    private final MongoTemplate mongoTemplate;
    private final CategoryRepository categoryRepository;
    private final CurrentUser currentUser;
    private final Clock clock;

    public CategoryMemoryService(MongoTemplate mongoTemplate, CategoryRepository categoryRepository,
                                 CurrentUser currentUser, Clock clock) {
        this.mongoTemplate = mongoTemplate;
        this.categoryRepository = categoryRepository;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    /** A remembered choice shown to the AI: the merchant key and the category the user uses for it. */
    public record Example(String merchant, TransactionType type, String categoryId) {
    }

    public CategoryMemoryMatchResponse match(List<CategoryMemoryMatchRequest.Item> items) {
        String userId = currentUser.id();
        List<String> keys = items.stream().map(item -> MerchantKey.of(item.description())).toList();
        Set<String> tokens = keys.stream().filter(k -> !k.isEmpty()).map(MerchantKey::firstToken)
                .collect(Collectors.toSet());
        List<CategoryMemoryVote> votes = tokens.isEmpty() ? List.of()
                : mongoTemplate.find(query(where("userId").is(userId).and("token").in(tokens)),
                        CategoryMemoryVote.class);
        Map<String, TransactionType> valid = votes.isEmpty() ? Map.of() : categoryTypes(userId);

        Map<String, Map<String, Integer>> byKey = new HashMap<>();
        Map<String, Map<String, Integer>> byToken = new HashMap<>();
        for (CategoryMemoryVote vote : votes) {
            byKey.computeIfAbsent(group(vote.getType(), vote.getKey()), g -> new HashMap<>())
                    .merge(vote.getCategoryId(), vote.getHits(), Integer::sum);
            byToken.computeIfAbsent(group(vote.getType(), vote.getToken()), g -> new HashMap<>())
                    .merge(vote.getCategoryId(), vote.getHits(), Integer::sum);
        }

        List<CategoryMemoryMatchResponse.Suggestion> suggestions = new ArrayList<>(items.size());
        for (int i = 0; i < items.size(); i++) {
            CategoryMemoryMatchRequest.Item item = items.get(i);
            String key = keys.get(i);
            String categoryId = null;
            if (!key.isEmpty()) {
                categoryId = dominant(byKey.get(group(item.type(), key)), valid, item.type());
                String token = MerchantKey.firstToken(key);
                if (categoryId == null && MerchantKey.groupable(token)) {
                    categoryId = dominant(byToken.get(group(item.type(), token)), valid, item.type());
                }
            }
            suggestions.add(new CategoryMemoryMatchResponse.Suggestion(item.index(), categoryId));
        }
        return new CategoryMemoryMatchResponse(suggestions);
    }

    public void learn(List<CategoryMemoryLearnRequest.Entry> entries) {
        String userId = currentUser.id();
        Map<String, TransactionType> valid = categoryTypes(userId);
        Instant now = clock.instant();
        BulkOperations operations = null;
        for (CategoryMemoryLearnRequest.Entry entry : entries) {
            String key = MerchantKey.of(entry.description());
            // Unknown categories, or of the other type, teach nothing.
            if (key.isEmpty() || valid.get(entry.categoryId()) != entry.type()) {
                continue;
            }
            if (operations == null) {
                operations = mongoTemplate.bulkOps(BulkOperations.BulkMode.ORDERED, CategoryMemoryVote.class);
            }
            if (entry.corrected()) {
                operations.remove(byKey(userId, entry.type(), key).addCriteria(
                        where("categoryId").ne(entry.categoryId())));
            }
            operations.upsert(byKey(userId, entry.type(), key).addCriteria(where("categoryId").is(entry.categoryId())),
                    new Update().inc("hits", 1).set("token", MerchantKey.firstToken(key)).set("updatedAt", now));
        }
        if (operations != null) {
            operations.execute();
        }
    }

    /** Learns from one transaction saved by the user (added by hand or with its category changed). */
    public void learn(String description, TransactionType type, String categoryId, boolean corrected) {
        learn(List.of(new CategoryMemoryLearnRequest.Entry(description, type, categoryId, corrected)));
    }

    /** The user's habits most useful for categorizing {@code descriptions}: related merchants first, then recent. */
    public List<Example> examples(Collection<String> descriptions, Set<TransactionType> types) {
        if (descriptions.isEmpty() || types.isEmpty()) {
            return List.of();
        }
        String userId = currentUser.id();
        List<CategoryMemoryVote> votes = mongoTemplate.find(query(where("userId").is(userId).and("type").in(types))
                .with(Sort.by(Sort.Direction.DESC, "updatedAt")).limit(EXAMPLE_SCAN_LIMIT), CategoryMemoryVote.class);
        if (votes.isEmpty()) {
            return List.of();
        }
        Map<String, TransactionType> valid = categoryTypes(userId);
        Set<String> words = descriptions.stream().flatMap(d -> MerchantKey.tokens(d).stream())
                .collect(Collectors.toSet());

        Map<String, CategoryMemoryVote> first = new LinkedHashMap<>();
        Map<String, Map<String, Integer>> groups = new HashMap<>();
        for (CategoryMemoryVote vote : votes) {
            String group = group(vote.getType(), vote.getKey());
            first.putIfAbsent(group, vote);
            groups.computeIfAbsent(group, g -> new HashMap<>()).merge(vote.getCategoryId(), vote.getHits(),
                    Integer::sum);
        }
        List<Example> related = new ArrayList<>();
        List<Example> others = new ArrayList<>();
        first.forEach((group, vote) -> {
            String categoryId = dominant(groups.get(group), valid, vote.getType());
            if (categoryId == null) {
                return;
            }
            Example example = new Example(vote.getKey(), vote.getType(), categoryId);
            boolean isRelated = Stream.of(vote.getKey().split(" ")).anyMatch(words::contains);
            (isRelated ? related : others).add(example);
        });
        return Stream.concat(related.stream(), others.stream()).limit(MAX_EXAMPLES).toList();
    }

    /** Every remembered merchant, most recently taught first. */
    public List<CategoryMemoryEntryResponse> entries() {
        String userId = currentUser.id();
        List<CategoryMemoryVote> votes = mongoTemplate.find(query(where("userId").is(userId))
                .with(Sort.by(Sort.Direction.DESC, "updatedAt")), CategoryMemoryVote.class);
        Map<String, TransactionType> valid = votes.isEmpty() ? Map.of() : categoryTypes(userId);
        Map<String, List<CategoryMemoryVote>> groups = votes.stream()
                .filter(v -> valid.get(v.getCategoryId()) == v.getType())
                .collect(Collectors.groupingBy(v -> group(v.getType(), v.getKey()), LinkedHashMap::new,
                        Collectors.toList()));
        List<CategoryMemoryEntryResponse> entries = new ArrayList<>(groups.size());
        for (List<CategoryMemoryVote> group : groups.values()) {
            CategoryMemoryVote best = group.stream()
                    .max((a, b) -> Integer.compare(a.getHits(), b.getHits())).orElseThrow();
            int total = group.stream().mapToInt(CategoryMemoryVote::getHits).sum();
            entries.add(new CategoryMemoryEntryResponse(best.getType(), best.getKey(), best.getCategoryId(), total,
                    best.getHits() >= DOMINANT_SHARE * total, group.get(0).getUpdatedAt()));
        }
        return entries;
    }

    public void forget(TransactionType type, String key) {
        mongoTemplate.remove(byKey(currentUser.id(), type, key), CategoryMemoryVote.class);
    }

    public void forgetAll() {
        mongoTemplate.remove(query(where("userId").is(currentUser.id())), CategoryMemoryVote.class);
    }

    /** When a category is deleted its choices move to {@code toId} (same type), or are forgotten when it is null. */
    void moveCategory(String userId, String fromId, String toId) {
        Query from = query(where("userId").is(userId).and("categoryId").is(fromId));
        if (toId != null) {
            for (CategoryMemoryVote vote : mongoTemplate.find(from, CategoryMemoryVote.class)) {
                mongoTemplate.upsert(byKey(userId, vote.getType(), vote.getKey())
                                .addCriteria(where("categoryId").is(toId)),
                        new Update().inc("hits", vote.getHits()).set("token", vote.getToken())
                                .max("updatedAt", vote.getUpdatedAt()),
                        CategoryMemoryVote.class);
            }
        }
        mongoTemplate.remove(from, CategoryMemoryVote.class);
    }

    /**
     * The category with at least {@link #DOMINANT_SHARE} of the votes, among existing categories of {@code type};
     * null when there is none (no votes, or the user splits the merchant between categories).
     */
    static String dominant(Map<String, Integer> votes, Map<String, TransactionType> valid, TransactionType type) {
        if (votes == null) {
            return null;
        }
        String best = null;
        int bestHits = 0;
        int total = 0;
        for (Map.Entry<String, Integer> vote : votes.entrySet()) {
            if (valid.get(vote.getKey()) != type) {
                continue;
            }
            total += vote.getValue();
            if (vote.getValue() > bestHits) {
                best = vote.getKey();
                bestHits = vote.getValue();
            }
        }
        return best != null && bestHits >= DOMINANT_SHARE * total ? best : null;
    }

    private Map<String, TransactionType> categoryTypes(String userId) {
        Map<String, TransactionType> types = new HashMap<>();
        for (Category category : categoryRepository.findByUserId(userId, Sort.unsorted())) {
            types.put(category.getId(), category.getType());
        }
        return types;
    }

    private static Query byKey(String userId, TransactionType type, String key) {
        return query(where("userId").is(userId).and("type").is(type).and("key").is(key));
    }

    private static String group(TransactionType type, String key) {
        return type + "|" + key;
    }
}
