package com.smartbudget.ai;

import com.smartbudget.common.ApiException;
import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;

/** Maps failures of the OpenAI-compatible provider to controlled API errors (never leaks the key or raw bodies). */
final class AiProviderErrors {

    private static final Logger log = LoggerFactory.getLogger(AiProviderErrors.class);

    private AiProviderErrors() {
    }

    /** Translates any exception thrown by the REST client into an ApiException. */
    static ApiException map(RestClientException ex) {
        if (ex instanceof HttpStatusCodeException statusEx) {
            return mapStatus(statusEx.getStatusCode());
        }
        if (ex instanceof ResourceAccessException || isTimeout(ex)) {
            return mapIoFailure(ex);
        }
        log.warn("AI provider returned an unreadable response: {}", ex.getClass().getSimpleName());
        return new ApiException(HttpStatus.BAD_GATEWAY, "Răspunsul furnizorului AI nu a putut fi citit. Încearcă din nou.");
    }

    static ApiException mapStatus(HttpStatusCode status) {
        log.warn("AI provider answered with HTTP {}", status.value());
        if (status.value() == 429) {
            return new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                    "Limita de cereri a furnizorului AI a fost atinsă. Încearcă din nou peste câteva momente.");
        }
        if (status.value() == 401 || status.value() == 403) {
            return new ApiException(HttpStatus.BAD_GATEWAY,
                    "Furnizorul AI a refuzat autentificarea. Verifică configurarea cheii API.");
        }
        if (status.is5xxServerError()) {
            return new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Furnizorul AI este temporar indisponibil. Încearcă din nou.");
        }
        return new ApiException(HttpStatus.BAD_GATEWAY, "Cererea către furnizorul AI a eșuat. Încearcă din nou.");
    }

    static ApiException mapIoFailure(RestClientException ex) {
        boolean timeout = isTimeout(ex);
        log.warn("AI provider call failed: {}", timeout ? "timeout" : "connection error");
        return timeout
                ? new ApiException(HttpStatus.GATEWAY_TIMEOUT, "Furnizorul AI nu a răspuns la timp. Încearcă din nou.")
                : new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Furnizorul AI nu poate fi contactat. Încearcă din nou.");
    }

    static boolean isTimeout(Throwable ex) {
        for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
            if (cause instanceof SocketTimeoutException || cause instanceof HttpTimeoutException) {
                return true;
            }
        }
        return false;
    }
}
