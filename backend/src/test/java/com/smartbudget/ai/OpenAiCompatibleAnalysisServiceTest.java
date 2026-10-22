package com.smartbudget.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.smartbudget.common.ApiException;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class OpenAiCompatibleAnalysisServiceTest {

    private static final String URL = "http://ai.test/v1/chat/completions";

    private MockRestServiceServer server;
    private OpenAiCompatibleAnalysisService service;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai.test/v1");
        server = MockRestServiceServer.bindTo(builder).build();
        service = new OpenAiCompatibleAnalysisService(builder.build(), properties("test-key", Duration.ofSeconds(5)),
                AiTestData.MAPPER);
    }

    @Test
    void returnsValidatedAnalysisFromProvider() throws Exception {
        server.expect(requestTo(URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer test-key"))
                .andExpect(jsonPath("$.model").value("test-model"))
                .andExpect(jsonPath("$.response_format.type").value("json_object"))
                .andExpect(jsonPath("$.messages[0].role").value("system"))
                .andExpect(jsonPath("$.messages[1].content").value(org.hamcrest.Matchers.containsString("\"totalIncome\":6000.00")))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("test-key"))))
                .andRespond(withSuccess(completion(AiTestData.validJson()), MediaType.APPLICATION_JSON));

        AiAnalysis analysis = service.analyze(AiTestData.summary());

        assertThat(analysis.insights()).hasSize(2);
        assertThat(analysis.summary()).isNotBlank();
        server.verify();
    }

    @Test
    void invalidAiAnswerIsReportedAsBadGateway() throws Exception {
        server.expect(requestTo(URL))
                .andRespond(withSuccess(completion("Sigur! Iată câteva sfaturi..."), MediaType.APPLICATION_JSON));

        assertStatus(HttpStatus.BAD_GATEWAY);
    }

    @Test
    void emptyChoicesIsReportedAsBadGateway() {
        server.expect(requestTo(URL)).andRespond(withSuccess("{\"choices\":[]}", MediaType.APPLICATION_JSON));

        assertStatus(HttpStatus.BAD_GATEWAY);
    }

    @Test
    void timeoutIsReportedAsGatewayTimeout() {
        server.expect(requestTo(URL)).andRespond(request -> {
            throw new SocketTimeoutException("Read timed out");
        });

        assertStatus(HttpStatus.GATEWAY_TIMEOUT);
    }

    @Test
    void connectionFailureIsReportedAsServiceUnavailable() {
        server.expect(requestTo(URL)).andRespond(request -> {
            throw new IOException("Connection refused");
        });

        assertStatus(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void rateLimitIsReportedAsTooManyRequests() {
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        assertStatus(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void providerServerErrorIsReportedAsServiceUnavailable() {
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

        assertStatus(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void rejectedCredentialsAreReportedAsBadGatewayWithoutLeakingTheKey() {
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        assertThatThrownBy(() -> service.analyze(AiTestData.summary()))
                .isInstanceOfSatisfying(ApiException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY);
                    assertThat(ex.getMessage()).doesNotContain("test-key");
                });
    }

    @Test
    void missingApiKeyFailsWithoutCallingTheProvider() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai.test/v1");
        MockRestServiceServer noCalls = MockRestServiceServer.bindTo(builder).build();
        OpenAiCompatibleAnalysisService unconfigured = new OpenAiCompatibleAnalysisService(builder.build(),
                properties("", Duration.ofSeconds(5)), AiTestData.MAPPER);

        assertThatThrownBy(() -> unconfigured.analyze(AiTestData.summary()))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        noCalls.verify();
    }

    @Test
    void realReadTimeoutAgainstSlowProviderIsReportedAsGatewayTimeout() throws Exception {
        HttpServer slow = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        slow.createContext("/v1/chat/completions", exchange -> {
            try {
                Thread.sleep(1500);
                byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            } catch (InterruptedException | IOException ignored) {
                // client already gave up
            } finally {
                exchange.close();
            }
        });
        slow.start();
        try {
            AiProperties props = new AiProperties("http://127.0.0.1:" + slow.getAddress().getPort() + "/v1", "k",
                    "m", Duration.ofSeconds(2), Duration.ofMillis(300), null, true);
            AiConfig config = new AiConfig();
            OpenAiCompatibleAnalysisService real = new OpenAiCompatibleAnalysisService(
                    config.aiRestClient(RestClient.builder(), props), props, AiTestData.MAPPER);

            assertThatThrownBy(() -> real.analyze(AiTestData.summary()))
                    .isInstanceOfSatisfying(ApiException.class,
                            ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.GATEWAY_TIMEOUT));
        } finally {
            slow.stop(0);
        }
    }

    private void assertStatus(HttpStatus expected) {
        assertThatThrownBy(() -> service.analyze(AiTestData.summary()))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(expected));
    }

    private static AiProperties properties(String key, Duration readTimeout) {
        return new AiProperties("http://ai.test/v1", key, "test-model", Duration.ofSeconds(1), readTimeout, null, true);
    }

    private static String completion(String content) throws Exception {
        ObjectNode root = AiTestData.MAPPER.createObjectNode();
        root.putArray("choices").addObject().putObject("message").put("role", "assistant").put("content", content);
        return AiTestData.MAPPER.writeValueAsString(root);
    }
}
