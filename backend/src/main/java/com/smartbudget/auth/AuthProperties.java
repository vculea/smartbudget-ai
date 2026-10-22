package com.smartbudget.auth;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Sign-in settings. {@code googleClientId} is the OAuth client id (public) created in Google Cloud Console.
 * {@code jwtSecret} signs the application session tokens (HS256, at least 32 bytes); when empty a random
 * secret is generated at startup, so sessions do not survive a restart. {@code allowedEmails} optionally
 * restricts who may sign in (empty = any verified Google account).
 */
@ConfigurationProperties(prefix = "smartbudget.auth")
public record AuthProperties(
        String googleClientId,
        String jwtSecret,
        Duration tokenTtl,
        List<String> allowedEmails) {

    public static final int MIN_SECRET_BYTES = 32;

    public AuthProperties {
        googleClientId = googleClientId == null ? "" : googleClientId.strip();
        jwtSecret = jwtSecret == null ? "" : jwtSecret;
        tokenTtl = tokenTtl == null ? Duration.ofHours(12) : tokenTtl;
        allowedEmails = allowedEmails == null ? List.of() : allowedEmails.stream()
                .map(String::strip)
                .filter(email -> !email.isEmpty())
                .map(email -> email.toLowerCase(java.util.Locale.ROOT))
                .toList();
    }

    public boolean googleConfigured() {
        return !googleClientId.isEmpty();
    }

    public boolean isEmailAllowed(String email) {
        return allowedEmails.isEmpty()
                || (email != null && allowedEmails.contains(email.toLowerCase(java.util.Locale.ROOT)));
    }
}
