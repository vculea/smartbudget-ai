const latency = Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 400);

export const env = {
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api/v1",
  demoMode: import.meta.env.VITE_DEMO_MODE === "true",
  mockLatencyMs: Number.isFinite(latency) ? latency : 400,
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim(),
} as const;
