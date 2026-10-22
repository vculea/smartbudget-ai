package com.smartbudget.common;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.smartbudget.TestClock;
import com.smartbudget.ai.AiAnalysis;
import com.smartbudget.ai.AiInsightsController;
import com.smartbudget.ai.AiInsightsResponse;
import com.smartbudget.ai.AiInsightsService;
import com.smartbudget.budget.BudgetController;
import com.smartbudget.budget.BudgetService;
import com.smartbudget.goal.GoalController;
import com.smartbudget.goal.GoalService;
import com.smartbudget.transaction.TransactionController;
import com.smartbudget.transaction.TransactionService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = {TransactionController.class, BudgetController.class, GoalController.class,
        AiInsightsController.class})
@Import(ApiErrorHandlingTest.ClockConfig.class)
class ApiErrorHandlingTest {

    @TestConfiguration
    static class ClockConfig {
        @Bean
        Clock clock() {
            return TestClock.FIXED;
        }
    }

    @Autowired
    private MockMvc mvc;
    @MockitoBean
    private TransactionService transactionService;
    @MockitoBean
    private BudgetService budgetService;
    @MockitoBean
    private GoalService goalService;
    @MockitoBean
    private AiInsightsService aiInsightsService;

    @Test
    void invalidTransactionBodyReturns400WithFieldErrors() throws Exception {
        mvc.perform(post("/api/v1/transactions").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"EXPENSE\",\"amount\":-5,\"description\":\"\",\"transactionDate\":\"2026-10-01\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.fieldErrors.amount").exists())
                .andExpect(jsonPath("$.fieldErrors.description").exists())
                .andExpect(jsonPath("$.fieldErrors.categoryId").exists());
    }

    @Test
    void amountWithTooManyDecimalsIsRejected() throws Exception {
        mvc.perform(post("/api/v1/transactions").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"EXPENSE\",\"amount\":10.123,\"description\":\"x\","
                                + "\"transactionDate\":\"2026-10-01\",\"categoryId\":\"c\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.amount").exists());
    }

    @Test
    void malformedJsonReturns400() throws Exception {
        mvc.perform(post("/api/v1/transactions").contentType(MediaType.APPLICATION_JSON).content("{oops"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void invalidMonthParameterReturns400() throws Exception {
        mvc.perform(get("/api/v1/budgets").param("month", "2026-13"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("month")));
    }

    @Test
    void notFoundIsMappedTo404() throws Exception {
        when(transactionService.get("zzz")).thenThrow(ApiException.notFound("Tranzacția nu există."));

        mvc.perform(get("/api/v1/transactions/zzz"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Tranzacția nu există."));
    }

    @Test
    void conflictIsMappedTo409() throws Exception {
        when(goalService.contribute(any(), any())).thenThrow(ApiException.conflict("Obiectivul este deja finalizat."));

        mvc.perform(post("/api/v1/goals/g1/contributions").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":10}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Obiectivul este deja finalizat."));
    }

    @Test
    void unexpectedErrorsDoNotLeakDetails() throws Exception {
        when(transactionService.get("boom")).thenThrow(new IllegalStateException("secret internal detail"));

        mvc.perform(get("/api/v1/transactions/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.not(containsString("secret"))));
    }

    @Test
    void unknownRouteReturnsJson404() throws Exception {
        mvc.perform(get("/api/v1/nothing-here"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void deleteReturns204() throws Exception {
        mvc.perform(delete("/api/v1/transactions/t1")).andExpect(status().isNoContent());
    }

    @Test
    void aiInsightsReturnsContractShape() throws Exception {
        when(aiInsightsService.generate(YearMonth.of(2026, 9))).thenReturn(new AiInsightsResponse(
                YearMonth.of(2026, 9), "Rezumat",
                List.of(new AiAnalysis.Insight("Titlu", "Motiv", new BigDecimal("50.00"), AiAnalysis.Priority.HIGH)),
                TestClock.FIXED.instant()));

        mvc.perform(post("/api/v1/ai/insights").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"month\":\"2026-09\",\"totalIncome\":999999}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.month").value("2026-09"))
                .andExpect(jsonPath("$.summary").value("Rezumat"))
                .andExpect(jsonPath("$.insights[0].title").value("Titlu"))
                .andExpect(jsonPath("$.insights[0].reason").value("Motiv"))
                .andExpect(jsonPath("$.insights[0].suggestedMonthlySaving").value(50.0))
                .andExpect(jsonPath("$.insights[0].priority").value("HIGH"));
    }

    @Test
    void aiProviderFailuresAreReturnedAsControlledErrors() throws Exception {
        when(aiInsightsService.generate(any())).thenThrow(new ApiException(HttpStatus.GATEWAY_TIMEOUT, "Furnizorul AI nu a răspuns la timp."));

        mvc.perform(post("/api/v1/ai/insights").contentType(MediaType.APPLICATION_JSON).content("{\"month\":\"2026-09\"}"))
                .andExpect(status().isGatewayTimeout())
                .andExpect(jsonPath("$.status").value(504))
                .andExpect(jsonPath("$.message").value("Furnizorul AI nu a răspuns la timp."));
    }

    @Test
    void aiInsightsAcceptsEmptyBody() throws Exception {
        when(aiInsightsService.generate(null)).thenThrow(new ApiException(HttpStatus.TOO_MANY_REQUESTS, "rate limit"));

        mvc.perform(post("/api/v1/ai/insights"))
                .andExpect(status().isTooManyRequests());
    }
}
