package com.smartbudget.transaction;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import com.smartbudget.ai.ReceiptScanResult;
import com.smartbudget.common.PageResponse;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/transactions")
@Tag(name = "Transactions")
public class TransactionController {

    private final TransactionService service;
    private final TransactionScanService scanService;
    private final TransactionAttachmentService attachmentService;

    public TransactionController(TransactionService service, TransactionScanService scanService,
                                 TransactionAttachmentService attachmentService) {
        this.service = service;
        this.scanService = scanService;
        this.attachmentService = attachmentService;
    }

    @PostMapping(value = "/{id}/attachment", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Save the receipt / invoice of a transaction in Google Drive",
            description = "Multipart field 'file' (PDF, JPEG, PNG or WebP, max 8 MB). Stored under <root>/yyyy/MM in the "
                    + "configured Google account; replaces (and trashes) a previous attachment. Returns the transaction with "
                    + "attachmentName and attachmentUrl. Errors: 413 too large, 415 wrong type, 502/503/504 Drive problems, "
                    + "503 when GOOGLE_DRIVE_* is not configured.")
    public TransactionResponse attach(@PathVariable String id, @RequestPart("file") MultipartFile file) {
        return attachmentService.attach(id, file);
    }

    @DeleteMapping("/{id}/attachment")
    @Operation(summary = "Remove the receipt of a transaction",
            description = "Unlinks the file and moves it to the Google Drive trash (recoverable for 30 days).")
    public TransactionResponse detach(@PathVariable String id) {
        return attachmentService.detach(id);
    }

    @PostMapping(value = "/scan", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Propose transactions from a receipt or statement photo",
            description = "Multipart field 'image' (JPEG, PNG or WebP, max 8 MB). The AI reads the amount, date, description and "
                    + "picks one of the existing categories. Returns {transactions: [...]}: one entry for a receipt or invoice, "
                    + "several for a statement or a list of payments. Nothing is saved: the client reviews the values and then "
                    + "calls POST /transactions or POST /transactions/bulk. "
                    + "amount and categoryId may be null when unreadable. Errors: 413 too large, 415 not an image, "
                    + "422 nothing recognized, 429/502/503/504 AI provider problems.")
    public ReceiptScanResult scan(@RequestPart("image") MultipartFile image) {
        return scanService.scan(image);
    }

    @GetMapping
    @Operation(summary = "List transactions",
            description = "Optional filters: type, categoryId, startDate, endDate (inclusive), search (description). "
                    + "Pagination: page (0-based), size (max 100), sort=field,dir with field in transactionDate|amount|createdAt.")
    public PageResponse<TransactionResponse> list(
            @ModelAttribute TransactionFilter filter,
            @Parameter(hidden = true) @PageableDefault(size = 20) Pageable pageable) {
        return PageResponse.of(service.list(filter, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a transaction by id")
    public TransactionResponse get(@PathVariable String id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a transaction")
    public TransactionResponse create(@Valid @RequestBody TransactionRequest request) {
        return service.create(request);
    }

    @PostMapping("/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create several transactions at once",
            description = "Used by the CSV/Excel import after the user reviewed the preview. Max 1000 items. "
                    + "All-or-nothing: if any item is invalid (e.g. 422 category/type mismatch) nothing is saved.")
    public BulkTransactionResponse createBulk(@Valid @RequestBody BulkTransactionRequest request) {
        return service.createAll(request);
    }

    @PostMapping("/import/existing")
    @Operation(summary = "Find the import rows that are already saved",
            description = "Used by the CSV/Excel import preview so the same statement is not imported twice. Max 1000 items. "
                    + "A row matches a saved transaction with the same type, date, amount and description (ignoring case, "
                    + "diacritics and punctuation); each saved transaction matches at most one row. Nothing is saved.")
    public ExistingTransactionsResponse existing(@Valid @RequestBody ExistingTransactionsRequest request) {
        return service.findExisting(request);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Replace a transaction")
    public TransactionResponse update(@PathVariable String id, @Valid @RequestBody TransactionRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a transaction")
    public void delete(@PathVariable String id) {
        String fileId = attachmentService.fileIdOf(id);
        service.delete(id);
        attachmentService.trashQuietly(fileId);
    }
}
