import type { AuthSession } from "../types";

const STORAGE_KEY = "smartbudget.auth.session";

/** Evenimentul emis când serverul respinge tokenul (401): AuthProvider închide sesiunea. */
export const SESSION_EXPIRED_EVENT = "smartbudget:session-expired";

function isSession(value: unknown): value is AuthSession {
  const session = value as AuthSession | null;
  return (
    !!session &&
    typeof session.token === "string" &&
    typeof session.expiresAt === "string" &&
    !!session.user &&
    typeof session.user.id === "string"
  );
}

export function isExpired(session: AuthSession, now = Date.now()): boolean {
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt <= now;
}

/** Sesiunea salvată, dacă există și nu a expirat. */
export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSession(parsed) || isExpired(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // stocare indisponibilă (mod privat): sesiunea rămâne doar în memorie
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nimic de șters
  }
}

export function getToken(): string | null {
  return loadSession()?.token ?? null;
}
