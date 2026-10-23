package com.smartbudget.drive;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings of the single Google account that stores the receipts (OAuth refresh token, never sent to the browser).
 * Read from the GOOGLE_DRIVE_* environment variables; when any of them is empty the feature is disabled.
 */
@ConfigurationProperties(prefix = "smartbudget.drive")
public record DriveProperties(
        String clientId,
        String clientSecret,
        String refreshToken,
        /**
         * Optional id of an existing Drive folder. With the narrow drive.file scope the app can only use folders it
         * created itself, so when empty the app creates (and reuses) a "SmartBudget" folder in My Drive.
         */
        String folderId) {

    public DriveProperties {
        clientId = strip(clientId);
        clientSecret = strip(clientSecret);
        refreshToken = strip(refreshToken);
        folderId = strip(folderId);
    }

    public boolean isConfigured() {
        return !clientId.isEmpty() && !clientSecret.isEmpty() && !refreshToken.isEmpty();
    }

    private static String strip(String value) {
        return value == null ? "" : value.strip();
    }
}
