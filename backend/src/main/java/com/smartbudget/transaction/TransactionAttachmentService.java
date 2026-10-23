package com.smartbudget.transaction;

import com.smartbudget.auth.CurrentUser;
import com.smartbudget.common.ApiException;
import com.smartbudget.drive.DriveFile;
import com.smartbudget.drive.DriveStorage;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/** Archives the receipt / invoice of a transaction in Google Drive. */
@Service
public class TransactionAttachmentService {

    private static final Logger log = LoggerFactory.getLogger(TransactionAttachmentService.class);

    public static final long MAX_FILE_BYTES = TransactionScanService.MAX_IMAGE_BYTES;
    static final int MAX_NAME_PART = 40;

    private final TransactionRepository repository;
    private final TransactionService transactionService;
    private final DriveStorage storage;
    private final CurrentUser currentUser;
    private final Clock clock;

    public TransactionAttachmentService(TransactionRepository repository, TransactionService transactionService,
                                        DriveStorage storage, CurrentUser currentUser, Clock clock) {
        this.repository = repository;
        this.transactionService = transactionService;
        this.storage = storage;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    public TransactionResponse attach(String transactionId, MultipartFile file) {
        if (!storage.isEnabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Salvarea în Google Drive nu este configurată.");
        }
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("Fișierul este obligatoriu.");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "Fișierul depășește dimensiunea maximă de 8 MB.");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw ApiException.badRequest("Fișierul nu a putut fi citit.");
        }
        String mimeType = detectType(bytes);
        if (mimeType == null) {
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "Sunt acceptate doar fișiere PDF sau imagini JPEG, PNG, WebP.");
        }
        Transaction tx = find(transactionId);

        DriveFile uploaded = storage.upload(fileName(tx, mimeType), mimeType, bytes, tx.getTransactionDate());
        String previousFileId = tx.getAttachmentFileId();
        tx.setAttachmentFileId(uploaded.id());
        tx.setAttachmentName(uploaded.name());
        tx.setAttachmentUrl(uploaded.webViewLink());
        tx.setUpdatedAt(clock.instant());
        try {
            repository.save(tx);
        } catch (RuntimeException ex) {
            storage.trash(uploaded.id());
            throw ex;
        }
        if (previousFileId != null) {
            storage.trash(previousFileId);
        }
        return transactionService.get(transactionId);
    }

    public TransactionResponse detach(String transactionId) {
        Transaction tx = find(transactionId);
        String fileId = tx.getAttachmentFileId();
        if (fileId != null || tx.getAttachmentUrl() != null) {
            tx.setAttachmentFileId(null);
            tx.setAttachmentName(null);
            tx.setAttachmentUrl(null);
            tx.setUpdatedAt(clock.instant());
            repository.save(tx);
            storage.trash(fileId);
        }
        return transactionService.get(transactionId);
    }

    /** Drive file id of the transaction's receipt, or null; used to clean up when the transaction is deleted. */
    public String fileIdOf(String transactionId) {
        return repository.findByIdAndUserId(transactionId, currentUser.id())
                .map(Transaction::getAttachmentFileId).orElse(null);
    }

    public void trashQuietly(String fileId) {
        try {
            storage.trash(fileId);
        } catch (RuntimeException ex) {
            log.warn("Could not clean up the Drive receipt: {}", ex.getClass().getSimpleName());
        }
    }

    private Transaction find(String id) {
        return repository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> ApiException.notFound("Tranzacția nu există."));
    }

    /** Detects the type from the file signature; the client-declared content type is not trusted. */
    static String detectType(byte[] b) {
        if (b.length >= 5 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F' && b[4] == '-') {
            return "application/pdf";
        }
        return TransactionScanService.detectImageType(b);
    }

    /** E.g. {@code 2026-10-23_Kaufland_123.45.pdf}. */
    static String fileName(Transaction tx, String mimeType) {
        String extension = switch (mimeType) {
            case "application/pdf" -> "pdf";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "jpg";
        };
        String label = Normalizer.normalize(tx.getDescription() == null ? "" : tx.getDescription(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("[^A-Za-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
        if (label.length() > MAX_NAME_PART) {
            label = label.substring(0, MAX_NAME_PART).replaceAll("_+$", "");
        }
        BigDecimal amount = tx.getAmount() == null ? BigDecimal.ZERO : tx.getAmount();
        String name = tx.getTransactionDate() + (label.isEmpty() ? "" : "_" + label)
                + "_" + amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
        return name + "." + extension;
    }
}
