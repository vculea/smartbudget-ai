package com.smartbudget.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.smartbudget.category.CategoryResponse;
import com.smartbudget.common.ApiException;
import com.smartbudget.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class OpenAiCompatibleReceiptScannerTest {

    private static final String URL = "http://ai.test/v1/chat/completions";
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 22);
    private static final List<CategoryResponse> CATEGORIES = List.of(
            new CategoryResponse("food", "Alimente", TransactionType.EXPENSE, "#fff", "cart"),
            new CategoryResponse("fuel", "Transport", TransactionType.EXPENSE, "#fff", "car"),
            new CategoryResponse("salary", "Salariu", TransactionType.INCOME, "#fff", "cash"));

    private MockRestServiceServer server;
    private OpenAiCompatibleReceiptScanner scanner;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai.test/v1");
        server = MockRestServiceServer.bindTo(builder).build();
        scanner = new OpenAiCompatibleReceiptScanner(builder.build(), properties("test-key"), AiTestData.MAPPER);
    }

    @Test
    void sendsImageAndCategoriesToTheVisionModelAndReturnsValidatedFields() throws Exception {
        server.expect(requestTo(URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer test-key"))
                .andExpect(jsonPath("$.model").value("vision-model"))
                .andExpect(jsonPath("$.messages[0].content").value(org.hamcrest.Matchers.containsString("\"id\":\"food\"")))
                .andExpect(jsonPath("$.messages[0].content").value(org.hamcrest.Matchers.containsString("2026-10-22")))
                .andExpect(jsonPath("$.messages[1].content[1].image_url.url")
                        .value(org.hamcrest.Matchers.startsWith("data:image/png;base64,")))
                .andRespond(withSuccess(completion("""
                        {"type":"EXPENSE","amount":87.5,"description":"Kaufland - cumpărături",
                         "transactionDate":"2026-10-20","categoryId":"food"}"""), MediaType.APPLICATION_JSON));

        ReceiptScan scan = scanner.scan(new byte[] {1, 2, 3}, "image/png", CATEGORIES, TODAY);

        assertThat(scan.type()).isEqualTo(TransactionType.EXPENSE);
        assertThat(scan.amount()).isEqualByComparingTo("87.50");
        assertThat(scan.description()).isEqualTo("Kaufland - cumpărături");
        assertThat(scan.transactionDate()).isEqualTo(LocalDate.of(2026, 10, 20));
        assertThat(scan.categoryId()).isEqualTo("food");
        server.verify();
    }

    @Test
    void unknownCategoryIsDroppedInsteadOfTrustingTheModel() {
        ReceiptScan scan = scanner.parse("""
                {"type":"EXPENSE","amount":10,"description":"x","transactionDate":"2026-10-20","categoryId":"invented"}""",
                CATEGORIES, TODAY);

        assertThat(scan.categoryId()).isNull();
    }

    @Test
    void categoryOfTheOtherTypeIsDropped() {
        ReceiptScan scan = scanner.parse("""
                {"type":"EXPENSE","amount":10,"description":"x","transactionDate":"2026-10-20","categoryId":"salary"}""",
                CATEGORIES, TODAY);

        assertThat(scan.type()).isEqualTo(TransactionType.EXPENSE);
        assertThat(scan.categoryId()).isNull();
    }

    @Test
    void missingTypeIsInferredFromTheCategory() {
        ReceiptScan scan = scanner.parse("""
                {"amount":5000,"description":"Salariu","categoryId":"salary"}""", CATEGORIES, TODAY);

        assertThat(scan.type()).isEqualTo(TransactionType.INCOME);
    }

    @Test
    void futureOrUnreadableDateFallsBackToToday() {
        assertThat(scanner.parse("{\"amount\":1,\"transactionDate\":\"2027-01-01\"}", CATEGORIES, TODAY).transactionDate())
                .isEqualTo(TODAY);
        assertThat(scanner.parse("{\"amount\":1,\"transactionDate\":\"azi\"}", CATEGORIES, TODAY).transactionDate())
                .isEqualTo(TODAY);
        assertThat(scanner.parse("{\"amount\":1,\"transactionDate\":null}", CATEGORIES, TODAY).transactionDate())
                .isEqualTo(TODAY);
    }

    @Test
    void invalidAmountsBecomeNullButDescriptionIsKept() {
        for (String amount : List.of("-5", "0", "\"abc\"", "null", "99999999999")) {
            ReceiptScan scan = scanner.parse("{\"amount\":" + amount + ",\"description\":\"Cafea\"}", CATEGORIES, TODAY);
            assertThat(scan.amount()).as(amount).isNull();
            assertThat(scan.description()).isEqualTo("Cafea");
        }
    }

    @Test
    void parsesLocalizedAmountStrings() {
        assertThat(OpenAiCompatibleReceiptScanner.parseLocalizedNumber("1.234,56 RON")).isEqualByComparingTo("1234.56");
        assertThat(OpenAiCompatibleReceiptScanner.parseLocalizedNumber("1,234.56")).isEqualByComparingTo("1234.56");
        assertThat(OpenAiCompatibleReceiptScanner.parseLocalizedNumber("12,50")).isEqualByComparingTo("12.50");
        assertThat(OpenAiCompatibleReceiptScanner.parseLocalizedNumber("12.5")).isEqualByComparingTo("12.5");
        assertThat(OpenAiCompatibleReceiptScanner.parseLocalizedNumber("1.234")).isEqualByComparingTo("1234");
        assertThat(OpenAiCompatibleReceiptScanner.parseLocalizedNumber("RON")).isNull();
    }

    @Test
    void amountIsRoundedToTwoDecimalsAndDescriptionIsCleaned() {
        ReceiptScan scan = scanner.parse("{\"amount\":12.999,\"description\":\"  a\\n\\tb  \"}", CATEGORIES, TODAY);

        assertThat(scan.amount()).isEqualByComparingTo(new BigDecimal("13.00"));
        assertThat(scan.description()).isEqualTo("a b");
    }

    @Test
    void nothingRecognizedIsUnprocessable() {
        assertThatThrownBy(() -> scanner.parse("{\"amount\":null,\"description\":\"\"}", CATEGORIES, TODAY))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY));
    }

    @Test
    void nonJsonAnswerIsBadGateway() {
        assertThatThrownBy(() -> scanner.parse("Nu pot citi imaginea", CATEGORIES, TODAY))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    void acceptsAnswerWrappedInCodeFence() {
        ReceiptScan scan = scanner.parse("```json\n{\"amount\":3.2,\"description\":\"Apa\"}\n```", CATEGORIES, TODAY);

        assertThat(scan.amount()).isEqualByComparingTo("3.20");
    }

    @Test
    void providerFailuresAreMappedToControlledErrors() {
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        assertThatThrownBy(() -> scanner.scan(new byte[] {1}, "image/jpeg", CATEGORIES, TODAY))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
    }

    @Test
    void missingApiKeyFailsWithoutCallingTheProvider() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai.test/v1");
        MockRestServiceServer noCalls = MockRestServiceServer.bindTo(builder).build();
        OpenAiCompatibleReceiptScanner unconfigured = new OpenAiCompatibleReceiptScanner(builder.build(),
                properties(""), AiTestData.MAPPER);

        assertThatThrownBy(() -> unconfigured.scan(new byte[] {1}, "image/jpeg", CATEGORIES, TODAY))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        noCalls.verify();
    }

    private static AiProperties properties(String key) {
        return new AiProperties("http://ai.test/v1", key, "text-model", Duration.ofSeconds(1), Duration.ofSeconds(5),
                null, true, "vision-model");
    }

    private static String completion(String content) throws Exception {
        ObjectNode root = AiTestData.MAPPER.createObjectNode();
        root.putArray("choices").addObject().putObject("message").put("role", "assistant").put("content", content);
        return AiTestData.MAPPER.writeValueAsString(root);
    }
}
