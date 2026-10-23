package com.smartbudget.transaction;

import com.smartbudget.ai.ReceiptScanResult;
import com.smartbudget.ai.ReceiptScanner;
import com.smartbudget.category.CategoryService;
import com.smartbudget.common.ApiException;
import java.io.IOException;
import java.time.Clock;
import java.time.LocalDate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/** Turns an uploaded receipt / statement photo into proposed (unsaved) transactions. */
@Service
public class TransactionScanService {

    public static final long MAX_IMAGE_BYTES = 8L * 1024 * 1024;

    private final ReceiptScanner scanner;
    private final CategoryService categoryService;
    private final Clock clock;

    public TransactionScanService(ReceiptScanner scanner, CategoryService categoryService, Clock clock) {
        this.scanner = scanner;
        this.categoryService = categoryService;
        this.clock = clock;
    }

    public ReceiptScanResult scan(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("Imaginea este obligatorie.");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "Imaginea depășește dimensiunea maximă de 8 MB.");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw ApiException.badRequest("Imaginea nu a putut fi citită.");
        }
        String mimeType = detectImageType(bytes);
        if (mimeType == null) {
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Sunt acceptate doar imagini JPEG, PNG sau WebP.");
        }
        return scanner.scan(bytes, mimeType, categoryService.list(), LocalDate.now(clock));
    }

    /** Detects the type from the file signature; the client-declared content type is not trusted. */
    static String detectImageType(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G'
                && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) {
            return "image/png";
        }
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return "image/webp";
        }
        return null;
    }
}
