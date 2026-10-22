package com.smartbudget.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code credential} is the Google ID token (JWT) returned by Google Identity Services. */
public record GoogleLoginRequest(@NotBlank @Size(max = 4096) String credential) {
}
