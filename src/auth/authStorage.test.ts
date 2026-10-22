import { beforeEach, describe, expect, it } from "vitest";
import type { AuthSession } from "../types";
import {
  clearSession,
  getToken,
  isExpired,
  loadSession,
  saveSession,
} from "./authStorage";

function session(expiresAt: string): AuthSession {
  return {
    token: "app-token",
    expiresAt,
    user: { id: "u1", email: "ana@gmail.com", name: "Ana", pictureUrl: null },
  };
}

const FUTURE = new Date(Date.now() + 3_600_000).toISOString();
const PAST = new Date(Date.now() - 3_600_000).toISOString();

describe("authStorage", () => {
  beforeEach(() => localStorage.clear());

  it("păstrează și returnează o sesiune valabilă", () => {
    saveSession(session(FUTURE));

    expect(loadSession()?.user.email).toBe("ana@gmail.com");
    expect(getToken()).toBe("app-token");
  });

  it("șterge și ignoră o sesiune expirată", () => {
    saveSession(session(PAST));

    expect(loadSession()).toBeNull();
    expect(getToken()).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("ignoră date corupte", () => {
    localStorage.setItem("smartbudget.auth.session", "{nu e json");
    expect(loadSession()).toBeNull();

    localStorage.setItem("smartbudget.auth.session", '{"token":1}');
    expect(loadSession()).toBeNull();
  });

  it("clearSession elimină sesiunea", () => {
    saveSession(session(FUTURE));
    clearSession();

    expect(loadSession()).toBeNull();
  });

  it("consideră expirată o dată invalidă", () => {
    expect(isExpired(session("nu-e-data"))).toBe(true);
  });
});
