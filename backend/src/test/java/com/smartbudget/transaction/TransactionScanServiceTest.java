package com.smartbudget.transaction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.smartbudget.TestClock;
import com.smartbudget.ai.ReceiptScan;
import com.smartbudget.ai.ReceiptScanResult;
import com.smartbudget.ai.ReceiptScanner;
import com.smartbudget.category.CategoryResponse;
import com.smartbudget.category.CategoryService;
import com.smartbudget.common.ApiException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

class TransactionScanServiceTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0};
    private static final byte[] WEBP = {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'};

    private ReceiptScanner scanner;
    private CategoryService categories;
    private TransactionScanService service;

    @BeforeEach
    void setUp() {
        scanner = mock(ReceiptScanner.class);
        categories = mock(CategoryService.class);
        service = new TransactionScanService(scanner, categories, TestClock.FIXED);
    }

    @Test
    void detectsRealImageTypeIgnoringDeclaredContentType() {
        List<CategoryResponse> list = List.of();
        ReceiptScanResult expected = new ReceiptScanResult(List.of(new ReceiptScan(TransactionType.EXPENSE,
                new BigDecimal("10.00"), "x", LocalDate.of(2026, 10, 22), null)));
        when(categories.list()).thenReturn(list);
        when(scanner.scan(any(), any(), any(), any())).thenReturn(expected);

        ReceiptScanResult result = service.scan(new MockMultipartFile("image", "bon.txt", "text/plain", JPEG));

        assertThat(result).isSameAs(expected);
        verify(scanner).scan(JPEG, "image/jpeg", list, LocalDate.of(2026, 10, 22));
    }

    @Test
    void recognizesPngAndWebp() {
        assertThat(TransactionScanService.detectImageType(PNG)).isEqualTo("image/png");
        assertThat(TransactionScanService.detectImageType(WEBP)).isEqualTo("image/webp");
        assertThat(TransactionScanService.detectImageType(new byte[] {1, 2, 3})).isNull();
    }

    @Test
    void rejectsNonImagesWithoutCallingTheAi() {
        MockMultipartFile fake = new MockMultipartFile("image", "bon.jpg", "image/jpeg", "<html>".getBytes());

        assertThatThrownBy(() -> service.scan(fake)).isInstanceOfSatisfying(ApiException.class,
                ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE));
        verifyNoInteractions(scanner);
    }

    @Test
    void rejectsEmptyAndOversizedFiles() {
        assertThatThrownBy(() -> service.scan(new MockMultipartFile("image", new byte[0])))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));

        byte[] big = new byte[(int) TransactionScanService.MAX_IMAGE_BYTES + 1];
        System.arraycopy(JPEG, 0, big, 0, JPEG.length);
        assertThatThrownBy(() -> service.scan(new MockMultipartFile("image", "bon.jpg", "image/jpeg", big)))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE));
        verifyNoInteractions(scanner);
    }
}
