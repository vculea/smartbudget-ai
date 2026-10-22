package com.smartbudget.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.smartbudget.common.ApiException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

class GoogleIdTokenVerifierTest {

    private static final String CLIENT_ID = "client-123.apps.googleusercontent.com";

    private static KeyPair keys;
    private final GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier(
            new AuthProperties(CLIENT_ID, null, null, null),
            NimbusJwtDecoder.withPublicKey((RSAPublicKey) keys.getPublic()).build());

    @BeforeAll
    static void generateKeys() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        keys = generator.generateKeyPair();
    }

    @Test
    void acceptsAValidToken() throws Exception {
        GoogleProfile profile = verifier.verify(token(claims().build()));

        assertThat(profile.subject()).isEqualTo("google-sub-1");
        assertThat(profile.email()).isEqualTo("ana@gmail.com");
        assertThat(profile.name()).isEqualTo("Ana");
        assertThat(profile.pictureUrl()).isEqualTo("https://example.com/ana.png");
    }

    @Test
    void acceptsTheBareIssuerVariant() throws Exception {
        assertThat(verifier.verify(token(claims().issuer("accounts.google.com").build())).subject())
                .isEqualTo("google-sub-1");
    }

    @Test
    void rejectsTokenForAnotherClient() throws Exception {
        assertUnauthorized(token(claims().audience(List.of("someone-else")).build()));
    }

    @Test
    void rejectsTokenFromAnotherIssuer() throws Exception {
        assertUnauthorized(token(claims().issuer("https://evil.example.com").build()));
    }

    @Test
    void rejectsExpiredToken() throws Exception {
        assertUnauthorized(token(claims().expirationTime(Date.from(Instant.now().minus(Duration.ofHours(1)))).build()));
    }

    @Test
    void rejectsUnverifiedEmail() throws Exception {
        assertUnauthorized(token(claims().claim("email_verified", false).build()));
    }

    @Test
    void rejectsTokenSignedWithAnotherKey() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        assertUnauthorized(token(claims().build(), generator.generateKeyPair()));
    }

    @Test
    void rejectsGarbage() {
        assertUnauthorized("not-a-jwt");
    }

    @Test
    void reportsMissingConfiguration() {
        GoogleIdTokenVerifier unconfigured = new GoogleIdTokenVerifier(new AuthProperties("", null, null, null),
                NimbusJwtDecoder.withPublicKey((RSAPublicKey) keys.getPublic()).build());

        assertThatThrownBy(() -> unconfigured.verify("x"))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }

    private void assertUnauthorized(String token) {
        assertThatThrownBy(() -> verifier.verify(token))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    private static JWTClaimsSet.Builder claims() {
        return new JWTClaimsSet.Builder()
                .issuer("https://accounts.google.com")
                .audience(CLIENT_ID)
                .subject("google-sub-1")
                .issueTime(new Date())
                .expirationTime(Date.from(Instant.now().plus(Duration.ofHours(1))))
                .claim("email", "ana@gmail.com")
                .claim("email_verified", true)
                .claim("name", "Ana")
                .claim("picture", "https://example.com/ana.png");
    }

    private static String token(JWTClaimsSet claims) throws JOSEException {
        return token(claims, keys);
    }

    private static String token(JWTClaimsSet claims, KeyPair signingKeys) throws JOSEException {
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), claims);
        jwt.sign(new RSASSASigner(signingKeys.getPrivate()));
        return jwt.serialize();
    }
}
