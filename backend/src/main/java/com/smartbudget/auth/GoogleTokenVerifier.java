package com.smartbudget.auth;

/** Validates a Google ID token and returns its claims. Implementations throw {@code ApiException} on failure. */
public interface GoogleTokenVerifier {

    GoogleProfile verify(String idToken);
}
