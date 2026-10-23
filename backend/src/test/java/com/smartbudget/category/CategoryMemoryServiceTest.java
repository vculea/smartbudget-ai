package com.smartbudget.category;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smartbudget.TestClock;
import com.smartbudget.TestUser;
import com.smartbudget.transaction.TransactionType;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

class CategoryMemoryServiceTest {

    private static final TransactionType EXPENSE = TransactionType.EXPENSE;
    private static final TransactionType INCOME = TransactionType.INCOME;

    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final CategoryRepository categoryRepository = mock(CategoryRepository.class);
    private final BulkOperations bulk = mock(BulkOperations.class);
    private CategoryMemoryService service;

    @BeforeEach
    void setUp() {
        when(categoryRepository.findByUserId(TestUser.ID, Sort.unsorted())).thenReturn(List.of(
                new Category("food", "Alimente", EXPENSE, null, null),
                new Category("home", "Casă", EXPENSE, null, null),
                new Category("fun", "Ieșiri", EXPENSE, null, null),
                new Category("salary", "Salariu", INCOME, null, null)));
        when(mongoTemplate.bulkOps(BulkOperations.BulkMode.ORDERED, CategoryMemoryVote.class)).thenReturn(bulk);
        service = new CategoryMemoryService(mongoTemplate, categoryRepository, TestUser.current(), TestClock.FIXED);
    }

    @Test
    void matchesTheExactMerchantFirst() {
        givenVotes(vote(EXPENSE, "kaufland cluj napoca", "food", 3));

        assertThat(match(item(0, "KAUFLAND 0042 CLUJ-NAPOCA", EXPENSE))).containsExactly("food");
    }

    @Test
    void matchesOtherBranchesOfTheSameMerchantByTheFirstWord() {
        givenVotes(vote(EXPENSE, "kaufland cluj napoca", "food", 1), vote(EXPENSE, "kaufland iasi", "food", 2));

        assertThat(match(item(0, "KAUFLAND BRASOV", EXPENSE))).containsExactly("food");
    }

    @Test
    void leavesEmptyAMerchantSplitBetweenCategories() {
        givenVotes(vote(EXPENSE, "emag", "home", 3), vote(EXPENSE, "emag", "food", 2));

        assertThat(match(item(0, "EMAG.RO", EXPENSE))).containsOnlyNulls();
    }

    @Test
    void exactMatchWinsOverAnUndecidedGroup() {
        givenVotes(vote(EXPENSE, "ion popescu", "home", 2), vote(EXPENSE, "ion ionescu", "fun", 2));

        assertThat(match(item(0, "Ion Popescu", EXPENSE), item(1, "Ion Vasilescu", EXPENSE)))
                .containsExactly("home", null);
    }

    @Test
    void ignoresDeletedCategoriesAndCategoriesOfTheOtherType() {
        givenVotes(vote(EXPENSE, "glovo", "deleted", 5), vote(INCOME, "glovo", "salary", 5));

        assertThat(match(item(0, "GLOVO", EXPENSE))).containsOnlyNulls();
    }

    @Test
    void descriptionsWithoutAMerchantDoNotQueryTheDatabase() {
        assertThat(match(item(3, "POS 123456", EXPENSE))).containsOnlyNulls();
        verify(mongoTemplate, never()).find(any(Query.class), eq(CategoryMemoryVote.class));
    }

    @Test
    void aCorrectionReplacesWhatWasRememberedForTheMerchant() {
        service.learn(List.of(new CategoryMemoryLearnRequest.Entry("GLOVO 123 BUCURESTI", EXPENSE, "fun", true)));

        ArgumentCaptor<Query> removed = ArgumentCaptor.forClass(Query.class);
        verify(bulk).remove(removed.capture());
        Document removeQuery = removed.getValue().getQueryObject();
        assertThat(removeQuery.get("key")).isEqualTo("glovo bucuresti");
        assertThat(removeQuery.get("categoryId", Document.class).get("$ne")).isEqualTo("fun");

        ArgumentCaptor<Query> upserted = ArgumentCaptor.forClass(Query.class);
        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(bulk).upsert(upserted.capture(), update.capture());
        assertThat(upserted.getValue().getQueryObject()).containsEntry("userId", TestUser.ID)
                .containsEntry("type", EXPENSE).containsEntry("key", "glovo bucuresti").containsEntry("categoryId", "fun");
        Document set = update.getValue().getUpdateObject().get("$set", Document.class);
        assertThat(set).containsEntry("token", "glovo").containsEntry("updatedAt", TestClock.FIXED.instant());
        assertThat(update.getValue().getUpdateObject().get("$inc", Document.class)).containsEntry("hits", 1);
        verify(bulk).execute();
    }

    @Test
    void aConfirmationOnlyAddsToTheCount() {
        service.learn(List.of(new CategoryMemoryLearnRequest.Entry("Lidl", EXPENSE, "food", false)));

        verify(bulk, never()).remove(any(Query.class));
        verify(bulk).upsert(any(Query.class), any(Update.class));
        verify(bulk).execute();
    }

    @Test
    void learnsNothingFromUnknownCategoriesWrongTypesOrCodes() {
        service.learn(List.of(
                new CategoryMemoryLearnRequest.Entry("Lidl", EXPENSE, "deleted", false),
                new CategoryMemoryLearnRequest.Entry("Lidl", INCOME, "food", false),
                new CategoryMemoryLearnRequest.Entry("123456", EXPENSE, "food", true)));

        verify(mongoTemplate, never()).bulkOps(any(BulkOperations.BulkMode.class), eq(CategoryMemoryVote.class));
    }

    @Test
    void examplesListRelatedMerchantsFirstAndSkipUndecidedOnes() {
        givenVotes(
                vote(EXPENSE, "netflix", "fun", 1),
                vote(EXPENSE, "emag", "home", 1),
                vote(EXPENSE, "emag", "food", 1),
                vote(EXPENSE, "glovo bucuresti", "fun", 4));

        List<CategoryMemoryService.Example> examples = service.examples(List.of("GLOVO CLUJ"), Set.of(EXPENSE));

        assertThat(examples).extracting(CategoryMemoryService.Example::merchant)
                .containsExactly("glovo bucuresti", "netflix");
        assertThat(examples.get(0).categoryId()).isEqualTo("fun");
    }

    @Test
    void examplesReadOnlyTheNeededFieldsAndReuseTheGivenCategories() {
        givenVotes(vote(EXPENSE, "glovo bucuresti", "fun", 4));

        List<CategoryMemoryService.Example> examples = service.examples(List.of("GLOVO CLUJ"), Set.of(EXPENSE),
                Map.of("fun", EXPENSE));

        assertThat(examples).extracting(CategoryMemoryService.Example::categoryId).containsExactly("fun");
        verify(categoryRepository, never()).findByUserId(any(), any());
        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).find(query.capture(), eq(CategoryMemoryVote.class));
        assertThat(query.getValue().getFieldsObject().keySet())
                .containsExactlyInAnyOrder("key", "type", "categoryId", "hits");
    }

    @Test
    void entriesSummarizeEachMerchant() {
        givenVotes(vote(EXPENSE, "emag", "home", 3), vote(EXPENSE, "emag", "food", 2), vote(EXPENSE, "lidl", "food", 1));

        assertThat(service.entries()).containsExactly(
                new CategoryMemoryEntryResponse(EXPENSE, "emag", "home", 5, false, Instant.EPOCH),
                new CategoryMemoryEntryResponse(EXPENSE, "lidl", "food", 1, true, Instant.EPOCH));
    }

    @Test
    void dominantNeedsEightyPercentOfTheVotes() {
        Map<String, TransactionType> valid = Map.of("a", EXPENSE, "b", EXPENSE);

        assertThat(CategoryMemoryService.dominant(Map.of("a", 4, "b", 1), valid, EXPENSE)).isEqualTo("a");
        assertThat(CategoryMemoryService.dominant(Map.of("a", 3, "b", 1), valid, EXPENSE)).isNull();
        assertThat(CategoryMemoryService.dominant(null, valid, EXPENSE)).isNull();
    }

    private List<String> match(CategoryMemoryMatchRequest.Item... items) {
        return service.match(List.of(items)).suggestions().stream()
                .map(CategoryMemoryMatchResponse.Suggestion::categoryId).toList();
    }

    private void givenVotes(CategoryMemoryVote... votes) {
        when(mongoTemplate.find(any(Query.class), eq(CategoryMemoryVote.class))).thenReturn(List.of(votes));
    }

    private static CategoryMemoryMatchRequest.Item item(int index, String description, TransactionType type) {
        return new CategoryMemoryMatchRequest.Item(index, description, type);
    }

    private static CategoryMemoryVote vote(TransactionType type, String key, String categoryId, int hits) {
        CategoryMemoryVote vote = new CategoryMemoryVote();
        vote.setUserId(TestUser.ID);
        vote.setType(type);
        vote.setKey(key);
        vote.setToken(MerchantKey.firstToken(key));
        vote.setCategoryId(categoryId);
        vote.setHits(hits);
        vote.setUpdatedAt(Instant.EPOCH);
        return vote;
    }
}
