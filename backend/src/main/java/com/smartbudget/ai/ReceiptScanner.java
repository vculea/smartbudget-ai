package com.smartbudget.ai;

import com.smartbudget.category.CategoryResponse;
import java.time.LocalDate;
import java.util.List;

/** Reads a receipt / payment photo and proposes the transaction(s) it shows. */
public interface ReceiptScanner {

    /**
     * @param image      raw bytes of a JPEG, PNG or WebP image
     * @param mimeType   the detected MIME type of {@code image}
     * @param categories the only categories the result may refer to
     * @param today      used when the image has no readable date
     */
    ReceiptScanResult scan(byte[] image, String mimeType, List<CategoryResponse> categories, LocalDate today);
}
