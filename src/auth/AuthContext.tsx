import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { env } from "../config/env";
import type { AuthSession, AuthUser } from "../types";
import { authApi } from "./authApi";
import {
  SESSION_EXPIRED_EVENT,
  clearSession,
  loadSession,
  saveSession,
} from "./authStorage";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** Autentificare cu credentialul (ID token) returnat de Google. */
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
}

/** În modul demo datele sunt locale, fără server: nu există autentificare. */
const DEMO_USER: AuthUser = {
  id: "demo",
  email: "demo@smartbudget.local",
  name: "Utilizator demo",
  pictureUrl: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(() =>
    env.demoMode ? null : loadSession(),
  );

  const endSession = useCallback(() => {
    clearSession();
    setSession(null);
    // datele din cache aparțin utilizatorului anterior
    queryClient.clear();
  }, [queryClient]);

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const next = await authApi.loginWithGoogle(credential);
      queryClient.clear();
      saveSession(next);
      setSession(next);
    },
    [queryClient],
  );

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, endSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, endSession);
  }, [endSession]);

  const value = useMemo<AuthContextValue>(() => {
    const user = env.demoMode ? DEMO_USER : (session?.user ?? null);
    return {
      user,
      isAuthenticated: user !== null,
      loginWithGoogle,
      logout: endSession,
    };
  }, [session, loginWithGoogle, endSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth trebuie folosit în interiorul AuthProvider.");
  }
  return context;
}
