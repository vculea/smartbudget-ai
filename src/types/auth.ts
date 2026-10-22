export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
}

/** Răspunsul POST /auth/google. */
export interface AuthSession {
  token: string;
  /** Instant ISO-8601 (UTC). */
  expiresAt: string;
  user: AuthUser;
}
