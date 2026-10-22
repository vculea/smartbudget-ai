import { http } from "../api/http";
import type { AuthSession } from "../types";

export const authApi = {
  /** Schimbă credențialul Google (ID token) pe o sesiune a aplicației. */
  async loginWithGoogle(credential: string): Promise<AuthSession> {
    const { data } = await http.post<AuthSession>("/auth/google", {
      credential,
    });
    return data;
  },
};
