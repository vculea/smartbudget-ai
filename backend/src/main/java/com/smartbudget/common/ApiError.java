package com.smartbudget.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.Map;

/** Error body returned by every failing endpoint (matches the frontend ApiErrorBody). */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record ApiError(int status, String error, String message, Map<String, String> fieldErrors, Instant timestamp) {
}
