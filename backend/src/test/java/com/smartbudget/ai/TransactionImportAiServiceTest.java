package com.smartbudget.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartbudget.category.CategoryResponse;
import com.smartbudget.category.CategoryService;
import com.smartbudget.common.ApiException;
import com.smartbudget.transaction.TransactionType;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class TransactionImportAiServiceTest {

    private final CategoryService categories = mock(CategoryService.class);
    private TransactionImportAiService service;

    @BeforeEach
    void setUp() {
        when(categories.list()).thenReturn(List.of(
                new CategoryResponse("food", "Alimente", TransactionType.EXPENSE, null, null),
                new CategoryResponse("fun", "Divertisment", TransactionType.EXPENSE, null, null),
                new CategoryResponse("salary", "Salariu", TransactionType.INCOME, null, null)));
        service = new TransactionImportAiService(null,
                new AiProperties(null, null, null, null, null, null, null, null), new ObjectMapper(), categories);
    }

    @Test
    void parsesColumnMappingFromAFencedAnswer() {
        ImportColumnMapping mapping = service.columnsResult("""
                ```json
                {"headerRow": 3, "date": 0, "description": 2, "amount": null, "debit": 3, "credit": 4,
                 "type": null, "category": null, "dateFormat": "mdy"}
                ```""", 6);

        assertThat(mapping.headerRow()).isEqualTo(3);
        assertThat(mapping.date()).isZero();
        assertThat(mapping.description()).isEqualTo(2);
        assertThat(mapping.amount()).isNull();
        assertThat(mapping.debit()).isEqualTo(3);
        assertThat(mapping.credit()).isEqualTo(4);
        assertThat(mapping.dateFormat()).isEqualTo("MDY");
    }

    @Test
    void dropsOutOfRangeAndDuplicateColumns() {
        ImportColumnMapping mapping = service.columnsResult("""
                {"headerRow": 1, "date": 0, "description": 1, "amount": 2, "type": 2, "category": 9,
                 "dateFormat": "weird"}""", 3);

        assertThat(mapping.type()).isNull();
        assertThat(mapping.category()).isNull();
        assertThat(mapping.dateFormat()).isEqualTo("DMY");
    }

    @Test
    void keepsTheDescriptionSeparatorOnlyWhenItIsShort() {
        assertThat(service.columnsResult("""
                {"headerRow": 4, "date": 0, "description": 3, "amount": 4, "descriptionCutAt": ","}""", 6)
                .descriptionCutAt()).isEqualTo(",");
        assertThat(service.columnsResult("""
                {"headerRow": 4, "date": 0, "description": 3, "amount": 4, "descriptionCutAt": "far too long"}""", 6)
                .descriptionCutAt()).isNull();
        assertThat(service.columnsResult("""
                {"headerRow": 4, "date": 0, "description": 3, "amount": 4}""", 6)
                .descriptionCutAt()).isNull();
    }

    @Test
    void rejectsMappingWithoutRequiredColumns() {
        assertThatThrownBy(() -> service.columnsResult("{\"headerRow\": 1, \"date\": 0}", 3))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY));
    }

    @Test
    void rejectsAnswerThatIsNotJson() {
        assertThatThrownBy(() -> service.columnsResult("nu știu", 3))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    void keepsOnlyCategoriesOfTheRightTypeAndLeavesUnsureOnesEmpty() {
        List<ImportItem> items = List.of(
                new ImportItem(0, "MEGA IMAGE", TransactionType.EXPENSE),
                new ImportItem(1, "SALARIU OCT", TransactionType.INCOME),
                new ImportItem(2, "XYZ 123", TransactionType.EXPENSE),
                new ImportItem(3, "CINEMA", TransactionType.EXPENSE),
                new ImportItem(4, "ALTCEVA", TransactionType.EXPENSE));

        ImportCategorizeResponse response = service.categoriesResult("""
                {"results": [
                  {"index": 0, "categoryId": "food"},
                  {"index": 1, "categoryId": "food"},
                  {"index": 2, "categoryId": null},
                  {"index": 3, "categoryId": "inventat"},
                  {"index": 99, "categoryId": "fun"}]}""", items);

        assertThat(response.suggestions()).extracting(ImportCategorizeResponse.Suggestion::categoryId)
                .containsExactly("food", null, null, null, null);
        assertThat(response.suggestions()).extracting(ImportCategorizeResponse.Suggestion::index)
                .containsExactly(0, 1, 2, 3, 4);
    }

    @Test
    void categoriesPromptListsCategoriesAndTransactions() {
        ImportAiPrompt prompt = service.categoriesPrompt(List.of(new ImportItem(7, "MEGA IMAGE", TransactionType.EXPENSE)));

        assertThat(prompt.systemPrompt()).contains("\"id\":\"food\"").contains("Use null ONLY when");
        assertThat(prompt.userMessage()).contains("\"index\":7").contains("MEGA IMAGE").contains("EXPENSE");
    }
}
