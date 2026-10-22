package com.smartbudget.auth;

import com.smartbudget.common.ApiException;
import java.time.Clock;
import java.time.Instant;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final GoogleTokenVerifier googleVerifier;
    private final UserRepository users;
    private final TokenService tokens;
    private final AuthProperties properties;
    private final Clock clock;

    public AuthService(GoogleTokenVerifier googleVerifier, UserRepository users, TokenService tokens,
                       AuthProperties properties, Clock clock) {
        this.googleVerifier = googleVerifier;
        this.users = users;
        this.tokens = tokens;
        this.properties = properties;
        this.clock = clock;
    }

    /** Signs in (and registers on first login) the owner of a valid Google ID token. */
    public AuthResponse loginWithGoogle(String idToken) {
        GoogleProfile profile = googleVerifier.verify(idToken);
        if (!properties.isEmailAllowed(profile.email())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Contul " + profile.email() + " nu are acces la aplicație.");
        }
        User user = upsert(profile);
        TokenService.IssuedToken token = tokens.issue(user);
        return new AuthResponse(token.value(), token.expiresAt(), UserResponse.from(user));
    }

    public UserResponse me(String userId) {
        return users.findById(userId).map(UserResponse::from)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Utilizatorul nu mai există."));
    }

    private User upsert(GoogleProfile profile) {
        try {
            return save(users.findByGoogleSub(profile.subject()).orElseGet(User::new), profile);
        } catch (DuplicateKeyException ex) {
            // two first logins raced: the other request created the user
            return save(users.findByGoogleSub(profile.subject()).orElseThrow(() -> ex), profile);
        }
    }

    private User save(User user, GoogleProfile profile) {
        Instant now = clock.instant();
        if (user.getId() == null) {
            user.setGoogleSub(profile.subject());
            user.setCreatedAt(now);
        }
        user.setEmail(profile.email());
        user.setName(profile.name());
        user.setPictureUrl(profile.pictureUrl());
        user.setLastLoginAt(now);
        return users.save(user);
    }
}
