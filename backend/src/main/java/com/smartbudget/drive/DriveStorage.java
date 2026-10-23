package com.smartbudget.drive;

import java.time.LocalDate;

/** Where receipts and invoices are archived. */
public interface DriveStorage {

    boolean isEnabled();

    /** Uploads the file into the {@code yyyy/MM} sub-folder of the configured root folder. */
    DriveFile upload(String name, String mimeType, byte[] content, LocalDate date);

    /** Moves the file to the Drive trash (recoverable for 30 days). Never throws. */
    void trash(String fileId);
}
