package com.smartbudget.auth;

import java.time.Instant;

public record AuthResponse(String token, Instant expiresAt, UserResponse user) {
}
