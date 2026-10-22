package com.smartbudget.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smartbudget.TestClock;
import com.smartbudget.common.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

class AuthServiceTest {

    private final GoogleTokenVerifier google = mock(GoogleTokenVerifier.class);
    private final UserRepository users = mock(UserRepository.class);
    private final TokenService tokens = mock(TokenService.class);
    private final GoogleProfile profile = new GoogleProfile("sub-1", "Ana@Gmail.com", "Ana", "https://pic");

    @BeforeEach
    void setUp() {
        when(google.verify("id-token")).thenReturn(profile);
        when(users.save(any(User.class))).thenAnswer(inv -> {
            User user = inv.getArgument(0);
            if (user.getId() == null) {
                user.setId("u1");
            }
            return user;
        });
        when(tokens.issue(any(User.class))).thenReturn(
                new TokenService.IssuedToken("app-token", Instant.parse("2026-10-23T00:00:00Z")));
    }

    @Test
    void firstLoginRegistersTheUser() {
        when(users.findByGoogleSub("sub-1")).thenReturn(Optional.empty());

        AuthResponse response = service(List.of()).loginWithGoogle("id-token");

        assertThat(response.token()).isEqualTo("app-token");
        assertThat(response.user().id()).isEqualTo("u1");
        assertThat(response.user().email()).isEqualTo("Ana@Gmail.com");
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(users).save(saved.capture());
        assertThat(saved.getValue().getGoogleSub()).isEqualTo("sub-1");
        assertThat(saved.getValue().getCreatedAt()).isEqualTo(TestClock.FIXED.instant());
    }

    @Test
    void returningUserKeepsIdAndGetsProfileRefreshed() {
        User existing = new User();
        existing.setId("u1");
        existing.setGoogleSub("sub-1");
        existing.setName("Old name");
        existing.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        when(users.findByGoogleSub("sub-1")).thenReturn(Optional.of(existing));

        AuthResponse response = service(List.of()).loginWithGoogle("id-token");

        assertThat(response.user().id()).isEqualTo("u1");
        assertThat(response.user().name()).isEqualTo("Ana");
        assertThat(existing.getCreatedAt()).isEqualTo(Instant.parse("2026-01-01T00:00:00Z"));
        assertThat(existing.getLastLoginAt()).isEqualTo(TestClock.FIXED.instant());
    }

    @Test
    void accountOutsideTheAllowListIsForbidden() {
        assertThatThrownBy(() -> service(List.of("someone@else.com")).loginWithGoogle("id-token"))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        verify(users, never()).save(any());
    }

    @Test
    void allowListIsCaseInsensitive() {
        when(users.findByGoogleSub("sub-1")).thenReturn(Optional.empty());

        assertThat(service(List.of(" ana@gmail.com ")).loginWithGoogle("id-token").token()).isEqualTo("app-token");
    }

    @Test
    void invalidGoogleTokenIsPropagated() {
        when(google.verify("bad")).thenThrow(new ApiException(HttpStatus.UNAUTHORIZED, "invalid"));

        assertThatThrownBy(() -> service(List.of()).loginWithGoogle("bad"))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void meOfDeletedUserIsUnauthorized() {
        when(users.findById("gone")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service(List.of()).me("gone"))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void issuedSessionTokenRoundTripsThroughTheDecoder() {
        var config = new com.smartbudget.config.SecurityConfig();
        var properties = new AuthProperties("", "0123456789abcdef0123456789abcdef", null, null);
        var key = config.jwtSecretKey(properties);
        TokenService real = new TokenService(config.jwtEncoder(key), properties, TestClock.FIXED);
        JwtDecoder decoder = config.jwtDecoder(key);
        User user = new User();
        user.setId("u1");

        TokenService.IssuedToken token = real.issue(user);
        Jwt jwt = decoder.decode(token.value());

        assertThat(jwt.getSubject()).isEqualTo("u1");
        assertThat(token.expiresAt()).isEqualTo(TestClock.FIXED.instant().plus(properties.tokenTtl()));
    }

    @Test
    void shortJwtSecretIsRejectedAtStartup() {
        var config = new com.smartbudget.config.SecurityConfig();

        assertThatThrownBy(() -> config.jwtSecretKey(new AuthProperties("", "too-short", null, null)))
                .isInstanceOf(IllegalStateException.class);
    }

    private AuthService service(List<String> allowedEmails) {
        return new AuthService(google, users, tokens, new AuthProperties("cid", null, null, allowedEmails),
                TestClock.FIXED);
    }
}
