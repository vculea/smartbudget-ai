package com.smartbudget.transaction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.smartbudget.TestClock;
import com.smartbudget.TestUser;
import com.smartbudget.common.ApiException;
import com.smartbudget.drive.DriveFile;
import com.smartbudget.drive.DriveStorage;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

class TransactionAttachmentServiceTest {

    private static final byte[] PDF = "%PDF-1.7 data".getBytes(StandardCharsets.UTF_8);
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0};

    private TransactionRepository repository;
    private TransactionService transactions;
    private DriveStorage storage;
    private TransactionAttachmentService service;
    private Transaction tx;

    @BeforeEach
    void setUp() {
        repository = mock(TransactionRepository.class);
        transactions = mock(TransactionService.class);
        storage = mock(DriveStorage.class);
        service = new TransactionAttachmentService(repository, transactions, storage, TestUser.current(),
                TestClock.FIXED);

        tx = new Transaction();
        tx.setId("tx-1");
        tx.setUserId(TestUser.ID);
        tx.setAmount(new BigDecimal("123.4"));
        tx.setDescription("Kaufland – cumpărături / săptămâna");
        tx.setTransactionDate(LocalDate.of(2026, 10, 23));
        when(storage.isEnabled()).thenReturn(true);
        when(repository.findByIdAndUserId("tx-1", TestUser.ID)).thenReturn(Optional.of(tx));
    }

    @Test
    void uploadsWithAReadableNameAndStoresTheLink() {
        when(storage.upload(any(), any(), any(), any())).thenReturn(new DriveFile("f1", "n.pdf", "https://drive/f1"));

        service.attach("tx-1", new MockMultipartFile("file", "x.png", "image/png", PDF));

        verify(storage).upload("2026-10-23_Kaufland_cumparaturi_saptamana_123.40.pdf", "application/pdf", PDF,
                LocalDate.of(2026, 10, 23));
        ArgumentCaptor<Transaction> saved = ArgumentCaptor.forClass(Transaction.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getAttachmentFileId()).isEqualTo("f1");
        assertThat(saved.getValue().getAttachmentUrl()).isEqualTo("https://drive/f1");
        assertThat(saved.getValue().getAttachmentName()).isEqualTo("n.pdf");
        verify(storage, never()).trash(any());
    }

    @Test
    void replacingAnAttachmentTrashesTheOldFile() {
        tx.setAttachmentFileId("old");
        when(storage.upload(any(), any(), any(), any())).thenReturn(new DriveFile("f2", "n.jpg", "https://drive/f2"));

        service.attach("tx-1", new MockMultipartFile("file", "x.jpg", "image/jpeg", JPEG));

        verify(storage).trash("old");
    }

    @Test
    void trashesTheUploadedFileWhenSavingFails() {
        when(storage.upload(any(), any(), any(), any())).thenReturn(new DriveFile("f3", "n.pdf", "u"));
        when(repository.save(any())).thenThrow(new IllegalStateException("db down"));

        assertThatThrownBy(() -> service.attach("tx-1", new MockMultipartFile("file", "x.pdf", "application/pdf", PDF)))
                .isInstanceOf(IllegalStateException.class);
        verify(storage).trash("f3");
    }

    @Test
    void rejectsBadFilesBeforeTouchingDrive() {
        assertThatThrownBy(() -> service.attach("tx-1", new MockMultipartFile("file", "x.pdf", "application/pdf",
                "<html>".getBytes(StandardCharsets.UTF_8)))).isInstanceOfSatisfying(ApiException.class,
                ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE));
        assertThatThrownBy(() -> service.attach("tx-1", new MockMultipartFile("file", new byte[0])))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
        byte[] big = new byte[(int) TransactionAttachmentService.MAX_FILE_BYTES + 1];
        System.arraycopy(PDF, 0, big, 0, PDF.length);
        assertThatThrownBy(() -> service.attach("tx-1", new MockMultipartFile("file", "x.pdf", "application/pdf", big)))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE));
        verify(storage, never()).upload(any(), any(), any(), any());
    }

    @Test
    void failsWhenDriveIsNotConfigured() {
        when(storage.isEnabled()).thenReturn(false);

        assertThatThrownBy(() -> service.attach("tx-1", new MockMultipartFile("file", "x.pdf", "application/pdf", PDF)))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        verify(storage, never()).upload(any(), any(), any(), any());
    }

    @Test
    void unknownTransactionIsNotFoundAndNothingIsUploaded() {
        when(repository.findByIdAndUserId(eq("other"), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.attach("other", new MockMultipartFile("file", "x.pdf", "application/pdf", PDF)))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(storage, never()).upload(any(), any(), any(), any());
    }

    @Test
    void detachClearsTheLinkAndTrashesTheFile() {
        tx.setAttachmentFileId("f1");
        tx.setAttachmentName("n.pdf");
        tx.setAttachmentUrl("u");

        service.detach("tx-1");

        assertThat(tx.getAttachmentFileId()).isNull();
        assertThat(tx.getAttachmentName()).isNull();
        assertThat(tx.getAttachmentUrl()).isNull();
        verify(repository).save(tx);
        verify(storage).trash("f1");
    }

    @Test
    void detachWithoutAttachmentChangesNothing() {
        service.detach("tx-1");

        verify(repository, never()).save(any());
        verify(storage, never()).trash(any());
    }

    @Test
    void fileIdOfIsScopedToTheCurrentUser() {
        tx.setAttachmentFileId("f9");
        assertThat(service.fileIdOf("tx-1")).isEqualTo("f9");
        assertThat(service.fileIdOf("nope")).isNull();
        verifyNoInteractions(transactions);
    }

    @Test
    void namesFallBackWhenTheDescriptionHasNoLatinLetters() {
        tx.setDescription("***");
        assertThat(TransactionAttachmentService.fileName(tx, "image/webp")).isEqualTo("2026-10-23_123.40.webp");
    }
}
