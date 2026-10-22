package com.smartbudget.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication")
public class AuthController {

    private final AuthService service;
    private final CurrentUser currentUser;

    public AuthController(AuthService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    @PostMapping("/google")
    @SecurityRequirements
    @Operation(summary = "Sign in with a Google ID token",
            description = "Send the credential returned by Google Identity Services. The server verifies it, creates the "
                    + "user on first login and returns a bearer token for the other endpoints. "
                    + "Errors: 401 invalid token, 403 account not allowed, 503 Google sign-in not configured.")
    public AuthResponse google(@Valid @RequestBody GoogleLoginRequest request) {
        return service.loginWithGoogle(request.credential());
    }

    @GetMapping("/me")
    @Operation(summary = "The signed-in user")
    public UserResponse me() {
        return service.me(currentUser.id());
    }
}
