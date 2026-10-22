import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/errors";
import { LoginPage } from "../features/auth/LoginPage";
import { renderWithProviders } from "../test/renderWithProviders";
import type { AuthSession } from "../types";
import { authApi } from "./authApi";
import { RequireAuth } from "./RequireAuth";
import { SESSION_EXPIRED_EVENT, loadSession, saveSession } from "./authStorage";

vi.mock("../config/env", () => ({
  env: {
    apiBaseUrl: "/api/v1",
    demoMode: false,
    mockLatencyMs: 0,
    googleClientId: "client-id.apps.googleusercontent.com",
  },
}));

vi.mock("@react-oauth/google", () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  GoogleLogin: ({
    onSuccess,
  }: {
    onSuccess: (response: { credential?: string }) => void;
  }) => (
    <button onClick={() => onSuccess({ credential: "google-id-token" })}>
      Continuă cu Google
    </button>
  ),
}));

const SESSION: AuthSession = {
  token: "app-token",
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  user: { id: "u1", email: "ana@gmail.com", name: "Ana", pictureUrl: null },
};

function renderApp(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<p>Pagina protejată</p>} />
      </Route>
    </Routes>,
    { route },
  );
}

describe("autentificare", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("redirecționează vizitatorii neautentificați către login", async () => {
    renderApp("/dashboard");

    expect(
      await screen.findByRole("heading", { name: "SmartBudget AI" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Pagina protejată")).not.toBeInTheDocument();
  });

  it("permite accesul cu o sesiune salvată", async () => {
    saveSession(SESSION);

    renderApp("/dashboard");

    expect(await screen.findByText("Pagina protejată")).toBeInTheDocument();
  });

  it("autentifică cu credentialul Google și deschide aplicația", async () => {
    const login = vi.spyOn(authApi, "loginWithGoogle").mockResolvedValue(SESSION);
    renderApp("/dashboard");

    await userEvent.click(
      await screen.findByRole("button", { name: "Continuă cu Google" }),
    );

    expect(await screen.findByText("Pagina protejată")).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith("google-id-token");
    expect(loadSession()?.token).toBe("app-token");
  });

  it("afișează eroarea serverului când contul nu are acces", async () => {
    vi.spyOn(authApi, "loginWithGoogle").mockRejectedValue(
      new ApiError("Contul ana@gmail.com nu are acces la aplicație.", 403),
    );
    renderApp("/login");

    await userEvent.click(
      await screen.findByRole("button", { name: "Continuă cu Google" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "nu are acces la aplicație",
    );
    expect(loadSession()).toBeNull();
  });

  it("închide sesiunea când serverul semnalează expirarea", async () => {
    saveSession(SESSION);
    renderApp("/dashboard");
    expect(await screen.findByText("Pagina protejată")).toBeInTheDocument();

    act(() => {
      localStorage.clear();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    });

    await waitFor(() =>
      expect(screen.queryByText("Pagina protejată")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: "SmartBudget AI" }),
    ).toBeInTheDocument();
  });
});
