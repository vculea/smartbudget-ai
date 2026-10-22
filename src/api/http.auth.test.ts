import type { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_EXPIRED_EVENT, saveSession } from "../auth/authStorage";
import { ApiError } from "./errors";
import { http } from "./http";

const originalAdapter = http.defaults.adapter;
let calls: InternalAxiosRequestConfig[] = [];

function mockBackend(status: number, data: unknown = {}) {
  http.defaults.adapter = async (config) => {
    calls.push(config);
    const response = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400) {
      const { AxiosError } = await import("axios");
      throw new AxiosError("fail", String(status), config, null, response);
    }
    return response;
  };
}

beforeEach(() => {
  calls = [];
  localStorage.clear();
});
afterEach(() => {
  http.defaults.adapter = originalAdapter as AxiosRequestConfig["adapter"];
});

describe("http: autentificare", () => {
  it("trimite tokenul sesiunii ca Bearer", async () => {
    saveSession({
      token: "app-token",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: { id: "u1", email: "a@b.c", name: null, pictureUrl: null },
    });
    mockBackend(200);

    await http.get("/transactions");

    expect(calls[0]?.headers.get("Authorization")).toBe("Bearer app-token");
  });

  it("nu trimite Authorization fără sesiune", async () => {
    mockBackend(200);

    await http.get("/auth/me");

    expect(calls[0]?.headers.has("Authorization")).toBe(false);
  });

  it("anunță expirarea sesiunii la 401", async () => {
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    mockBackend(401, { message: "Sesiunea a expirat." });

    await expect(http.get("/transactions")).rejects.toBeInstanceOf(ApiError);

    expect(onExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  });

  it("un 401 la autentificare nu închide sesiunea", async () => {
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    mockBackend(401, { message: "Tokenul Google este invalid." });

    await expect(http.post("/auth/google", { credential: "x" })).rejects.toThrow(
      "Tokenul Google este invalid.",
    );

    expect(onExpired).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  });
});
