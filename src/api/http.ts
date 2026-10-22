import axios, { AxiosError } from "axios";
import { env } from "../config/env";
import type { ApiErrorBody } from "../types";
import { ApiError } from "./errors";

export const http = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 20_000,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (error instanceof AxiosError) {
      if (error.response) {
        const body = error.response.data as ApiErrorBody | undefined;
        return Promise.reject(
          new ApiError(
            body?.message ?? `Cererea a eșuat (cod ${error.response.status}).`,
            error.response.status,
            body?.fieldErrors,
          ),
        );
      }
      const message =
        error.code === "ECONNABORTED"
          ? "Serverul a răspuns prea greu. Încearcă din nou."
          : "Nu s-a putut contacta serverul. Verifică conexiunea sau pornește backendul.";
      return Promise.reject(new ApiError(message, 0));
    }
    return Promise.reject(error);
  },
);
