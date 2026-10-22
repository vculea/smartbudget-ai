package com.smartbudget.auth;

/** Verified claims of a Google ID token. */
public record GoogleProfile(String subject, String email, String name, String pictureUrl) {
}
