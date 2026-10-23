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
                        {"transactions":[{"type":"EXPENSE","amount":87.5,"description":"Kaufland - cumpărături",
                         "transactionDate":"2026-10-20","categoryId":"food"}]}"""), MediaType.APPLICATION_JSON));

        List<ReceiptScan> scans = scanner.scan(new byte[] {1, 2, 3}, "image/png", CATEGORIES, TODAY).transactions();

        assertThat(scans).hasSize(1);
        ReceiptScan scan = scans.get(0);
        assertThat(scan.type()).isEqualTo(TransactionType.EXPENSE);
        assertThat(scan.amount()).isEqualByComparingTo("87.50");
        assertThat(scan.description()).isEqualTo("Kaufland - cumpărături");
        assertThat(scan.transactionDate()).isEqualTo(LocalDate.of(2026, 10, 20));
        assertThat(scan.categoryId()).isEqualTo("food");
        server.verify();
    }

    @Test
    void readsSeveralTransactionsAndDropsUnrecognizableEntries() {
        List<ReceiptScan> scans = scanner.parse("""
                {"transactions":[
                  {"type":"EXPENSE","amount":"45,90","description":"Lidl","transactionDate":"2026-10-20","categoryId":"food"},
                  {"amount":null,"description":""},
                  "text",
                  {"type":"INCOME","amount":5000,"description":"Salariu","transactionDate":"2026-10-15","categoryId":"salary"}
                ]}""", CATEGORIES, TODAY).transactions();

        assertThat(scans).extracting(ReceiptScan::description).containsExactly("Lidl", "Salariu");
        assertThat(scans.get(0).amount()).isEqualByComparingTo("45.90");
        assertThat(scans.get(1).type()).isEqualTo(TransactionType.INCOME);
        assertThat(scans.get(1).categoryId()).isEqualTo("salary");
    }

    @Test
    void acceptsASingleObjectOrABareArray() {
        assertThat(scanner.parse("{\"amount\":10,\"description\":\"x\"}", CATEGORIES, TODAY).transactions())
                .hasSize(1);
        assertThat(scanner.parse("[{\"amount\":1},{\"amount\":2}]", CATEGORIES, TODAY).transactions())
                .hasSize(2);
    }

    @Test
    void keepsAtMostTheMaximumNumberOfTransactions() {
        String entries = String.join(",", java.util.Collections.nCopies(
                OpenAiCompatibleReceiptScanner.MAX_TRANSACTIONS + 5, "{\"amount\":1,\"description\":\"x\"}"));

        assertThat(scanner.parse("{\"transactions\":[" + entries + "]}", CATEGORIES, TODAY).transactions())
                .hasSize(OpenAiCompatibleReceiptScanner.MAX_TRANSACTIONS);
    }

    @Test
    void unknownCategoryIsDroppedInsteadOfTrustingTheModel() {
        ReceiptScan scan = one("""
                {"type":"EXPENSE","amount":10,"description":"x","transactionDate":"2026-10-20","categoryId":"invented"}""");

        assertThat(scan.categoryId()).isNull();
    }

    @Test
    void categoryOfTheOtherTypeIsDropped() {
        ReceiptScan scan = one("""
                {"type":"EXPENSE","amount":10,"description":"x","transactionDate":"2026-10-20","categoryId":"salary"}""");

        assertThat(scan.type()).isEqualTo(TransactionType.EXPENSE);
        assertThat(scan.categoryId()).isNull();
    }

    @Test
    void missingTypeIsInferredFromTheCategory() {
        ReceiptScan scan = one("""
                {"amount":5000,"description":"Salariu","categoryId":"salary"}""");

        assertThat(scan.type()).isEqualTo(TransactionType.INCOME);
    }

    @Test
    void futureOrUnreadableDateFallsBackToToday() {
        assertThat(one("{\"amount\":1,\"transactionDate\":\"2027-01-01\"}").transactionDate()).isEqualTo(TODAY);
        assertThat(one("{\"amount\":1,\"transactionDate\":\"azi\"}").transactionDate()).isEqualTo(TODAY);
        assertThat(one("{\"amount\":1,\"transactionDate\":null}").transactionDate()).isEqualTo(TODAY);
    }

    @Test
    void invalidAmountsBecomeNullButDescriptionIsKept() {
        for (String amount : List.of("-5", "0", "\"abc\"", "null", "99999999999")) {
            ReceiptScan scan = one("{\"amount\":" + amount + ",\"description\":\"Cafea\"}");
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
        ReceiptScan scan = one("{\"amount\":12.999,\"description\":\"  a\\n\\tb  \"}");

        assertThat(scan.amount()).isEqualByComparingTo(new BigDecimal("13.00"));
        assertThat(scan.description()).isEqualTo("a b");
    }

    @Test
    void nothingRecognizedIsUnprocessable() {
        for (String content : List.of("{\"amount\":null,\"description\":\"\"}", "{\"transactions\":[]}")) {
            assertThatThrownBy(() -> scanner.parse(content, CATEGORIES, TODAY))
                    .as(content)
                    .isInstanceOfSatisfying(ApiException.class,
                            ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY));
        }
    }

    @Test
    void nonJsonAnswerIsBadGateway() {
        assertThatThrownBy(() -> scanner.parse("Nu pot citi imaginea", CATEGORIES, TODAY))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    void acceptsAnswerWrappedInCodeFence() {
        ReceiptScan scan = one("```json\n{\"amount\":3.2,\"description\":\"Apa\"}\n```");

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

    private ReceiptScan one(String content) {
        List<ReceiptScan> scans = scanner.parse(content, CATEGORIES, TODAY).transactions();
        assertThat(scans).hasSize(1);
        return scans.get(0);
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
