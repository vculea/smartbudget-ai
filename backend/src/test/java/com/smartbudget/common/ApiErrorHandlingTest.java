package com.smartbudget.common;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.smartbudget.TestClock;
import com.smartbudget.ai.AiAnalysis;
import com.smartbudget.ai.AiInsightsController;
import com.smartbudget.ai.AiInsightsResponse;
import com.smartbudget.ai.AiInsightsService;
import com.smartbudget.ai.ReceiptScan;
import com.smartbudget.ai.ReceiptScanResult;
import com.smartbudget.budget.BudgetController;
import com.smartbudget.budget.BudgetService;
import com.smartbudget.goal.GoalController;
import com.smartbudget.goal.GoalService;
import com.smartbudget.transaction.TransactionAttachmentService;
import com.smartbudget.transaction.TransactionController;
import com.smartbudget.transaction.TransactionResponse;
import com.smartbudget.transaction.TransactionScanService;
import com.smartbudget.transaction.TransactionService;
import com.smartbudget.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = {TransactionController.class, BudgetController.class, GoalController.class,
        AiInsightsController.class})
@AutoConfigureMockMvc(addFilters = false)
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
    private TransactionScanService transactionScanService;
    @MockitoBean
    private TransactionAttachmentService transactionAttachmentService;
    @MockitoBean
    private BudgetService budgetService;
    @MockitoBean
    private GoalService goalService;
    @MockitoBean
    private AiInsightsService aiInsightsService;

    @Test
    void scanReturnsProposedTransactionFields() throws Exception {
        when(transactionScanService.scan(any())).thenReturn(new ReceiptScanResult(java.util.List.of(
                new ReceiptScan(TransactionType.EXPENSE, new BigDecimal("87.50"), "Kaufland",
                        LocalDate.of(2026, 10, 20), "food"))));

        mvc.perform(multipart("/api/v1/transactions/scan")
                        .file(new MockMultipartFile("image", "bon.jpg", "image/jpeg", new byte[] {1})))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactions[0].type").value("EXPENSE"))
                .andExpect(jsonPath("$.transactions[0].amount").value(87.5))
                .andExpect(jsonPath("$.transactions[0].description").value("Kaufland"))
                .andExpect(jsonPath("$.transactions[0].transactionDate").value("2026-10-20"))
                .andExpect(jsonPath("$.transactions[0].categoryId").value("food"));
    }

    @Test
    void attachmentUploadReturnsTheTransactionWithItsDriveLink() throws Exception {
        when(transactionAttachmentService.attach(eq("tx1"), any())).thenReturn(new TransactionResponse("tx1",
                TransactionType.EXPENSE, new BigDecimal("12.50"), "Kaufland", LocalDate.of(2026, 10, 20), "food",
                "Alimente", null, null, "2026-10-20_Kaufland_12.50.pdf", "https://drive.google.com/file/d/f1/view"));

        mvc.perform(multipart("/api/v1/transactions/tx1/attachment")
                        .file(new MockMultipartFile("file", "bon.pdf", "application/pdf", new byte[] {1})))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("tx1"))
                .andExpect(jsonPath("$.attachmentName").value("2026-10-20_Kaufland_12.50.pdf"))
                .andExpect(jsonPath("$.attachmentUrl").value("https://drive.google.com/file/d/f1/view"));
    }

    @Test
    void attachmentWithoutFilePartReturns400() throws Exception {
        mvc.perform(multipart("/api/v1/transactions/tx1/attachment"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("file")));
    }

    @Test
    void attachmentFailuresAreReturnedAsControlledErrors() throws Exception {
        when(transactionAttachmentService.attach(eq("tx1"), any()))
                .thenThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Salvarea în Google Drive nu este configurată."));

        mvc.perform(multipart("/api/v1/transactions/tx1/attachment")
                        .file(new MockMultipartFile("file", "bon.pdf", "application/pdf", new byte[] {1})))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("Salvarea în Google Drive nu este configurată."));
    }

    @Test
    void deletingATransactionTrashesItsDriveFileAfterTheTransactionIsGone() throws Exception {
        when(transactionAttachmentService.fileIdOf("tx1")).thenReturn("f1");

        mvc.perform(delete("/api/v1/transactions/tx1")).andExpect(status().isNoContent());

        InOrder order = inOrder(transactionService, transactionAttachmentService);
        order.verify(transactionService).delete("tx1");
        order.verify(transactionAttachmentService).trashQuietly("f1");
    }

    @Test
    void failedDeleteLeavesTheDriveFileAlone() throws Exception {
        when(transactionAttachmentService.fileIdOf("tx1")).thenReturn("f1");
        doThrow(ApiException.notFound("Tranzacția nu există.")).when(transactionService).delete("tx1");

        mvc.perform(delete("/api/v1/transactions/tx1")).andExpect(status().isNotFound());

        verify(transactionAttachmentService, never()).trashQuietly(any());
    }

    @Test
    void scanWithoutImagePartReturns400() throws Exception {
        mvc.perform(multipart("/api/v1/transactions/scan"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("image")));
    }

    @Test
    void scanFailuresAreReturnedAsControlledErrors() throws Exception {
        when(transactionScanService.scan(any()))
                .thenThrow(new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Nu am putut recunoaște o tranzacție."));

        mvc.perform(multipart("/api/v1/transactions/scan")
                        .file(new MockMultipartFile("image", "bon.jpg", "image/jpeg", new byte[] {1})))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("Nu am putut recunoaște o tranzacție."));
    }

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
                "2026-09", "Rezumat",
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
    void aiInsightsForYearUsesYearlyFigures() throws Exception {
        when(aiInsightsService.generateForYear(2026)).thenReturn(new AiInsightsResponse(
                "2026", "Rezumat anual", List.of(), TestClock.FIXED.instant()));

        mvc.perform(post("/api/v1/ai/insights").contentType(MediaType.APPLICATION_JSON).content("{\"year\":2026}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.month").value("2026"))
                .andExpect(jsonPath("$.summary").value("Rezumat anual"));
    }

    @Test
    void monthAndYearTogetherReturn400() throws Exception {
        mvc.perform(post("/api/v1/ai/insights").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"month\":\"2026-09\",\"year\":2026}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/budgets").param("month", "2026-09").param("year", "2026"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void yearOutOfRangeReturns400() throws Exception {
        mvc.perform(get("/api/v1/budgets").param("year", "1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("year")));
    }

    @Test
    void aiInsightsAcceptsEmptyBody() throws Exception {
        when(aiInsightsService.generate(null)).thenThrow(new ApiException(HttpStatus.TOO_MANY_REQUESTS, "rate limit"));

        mvc.perform(post("/api/v1/ai/insights"))
                .andExpect(status().isTooManyRequests());
    }
}
