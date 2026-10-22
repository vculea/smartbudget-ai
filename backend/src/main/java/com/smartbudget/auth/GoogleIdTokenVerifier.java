package com.smartbudget.auth;

import com.smartbudget.common.ApiException;
import java.net.URL;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Verifies Google ID tokens: RS256 signature against Google's published keys, issuer, audience (our client id),
 * expiry and a verified e-mail address.
 */
@Component
public class GoogleIdTokenVerifier implements GoogleTokenVerifier {

    static final String JWK_SET_URI = "https://www.googleapis.com/oauth2/v3/certs";
    private static final Set<String> ISSUERS = Set.of("https://accounts.google.com", "accounts.google.com");
    private static final Logger log = LoggerFactory.getLogger(GoogleIdTokenVerifier.class);

    private final AuthProperties properties;
    private final JwtDecoder decoder;

    @Autowired
    public GoogleIdTokenVerifier(AuthProperties properties) {
        this(properties, NimbusJwtDecoder.withJwkSetUri(JWK_SET_URI).build());
    }

    GoogleIdTokenVerifier(AuthProperties properties, NimbusJwtDecoder decoder) {
        this.properties = properties;
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(),
                issuerValidator(),
                audienceValidator(properties.googleClientId())));
        this.decoder = decoder;
    }

    @Override
    public GoogleProfile verify(String idToken) {
        if (!properties.googleConfigured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Autentificarea cu Google nu este configurată pe server (lipsește GOOGLE_CLIENT_ID).");
        }
        Jwt jwt;
        try {
            jwt = decoder.decode(idToken);
        } catch (BadJwtException ex) {
            log.debug("Rejected Google ID token: {}", ex.getMessage());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Tokenul Google este invalid sau a expirat.");
        } catch (JwtException ex) {
            log.warn("Could not verify Google ID token", ex);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Nu s-a putut verifica autentificarea cu Google.", ex);
        }
        if (!Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified")) || jwt.getClaimAsString("email") == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Adresa de e-mail a contului Google nu este verificată.");
        }
        return new GoogleProfile(jwt.getSubject(), jwt.getClaimAsString("email"), jwt.getClaimAsString("name"),
                jwt.getClaimAsString("picture"));
    }

    private static OAuth2TokenValidator<Jwt> issuerValidator() {
        return jwt -> {
            Object issuer = jwt.getClaims().get("iss");
            String value = issuer instanceof URL url ? url.toString() : String.valueOf(issuer);
            return ISSUERS.contains(value) ? OAuth2TokenValidatorResult.success() : failure("Invalid issuer");
        };
    }

    private static OAuth2TokenValidator<Jwt> audienceValidator(String clientId) {
        return jwt -> {
            List<String> audience = jwt.getAudience();
            return audience != null && audience.contains(clientId)
                    ? OAuth2TokenValidatorResult.success() : failure("Invalid audience");
        };
    }

    private static OAuth2TokenValidatorResult failure(String description) {
        return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", description, null));
    }
}
