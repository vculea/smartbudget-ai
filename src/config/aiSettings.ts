import { useSyncExternalStore } from "react";

/**
 * Setările AI ale utilizatorului, păstrate doar în acest browser.
 * - `server`: analiza și citirea bonurilor rulează în backend (model configurat de server, de obicei cu plată).
 * - `local`: browserul apelează direct un model de pe calculatorul utilizatorului (ex. Ollama); funcționează
 *   și când aplicația este publicată în cloud, pentru că cererea pornește din browser, nu din server.
 * - `own-key`: browserul apelează direct un furnizor cu plată (OpenAI, Groq, Gemini...) folosind cheia
 *   proprie a utilizatorului; cheia nu este trimisă către backend.
 */
export type AiMode = "server" | "local" | "own-key";

export interface LocalAiSettings {
  /** URL OpenAI-compatibil, ex. `http://localhost:11434/v1` pentru Ollama. */
  baseUrl: string;
  model: string;
  /** Model cu suport pentru imagini, folosit la citirea bonurilor. */
  visionModel: string;
  /** Trimite `response_format: json_object` (dezactivează dacă modelul îl refuză). */
  jsonMode: boolean;
  timeoutSeconds: number;
}

export type AiProviderId = "openai" | "groq" | "gemini" | "custom";

export interface OwnKeyAiSettings extends LocalAiSettings {
  provider: AiProviderId;
  /** Cheia utilizatorului; trimisă doar furnizorului ales, ca `Authorization: Bearer`. */
  apiKey: string;
}

/** Setările folosite efectiv de un apel făcut din browser (local sau cu cheie proprie). */
export interface BrowserAiConfig extends LocalAiSettings {
  apiKey?: string;
}

export interface AiSettings {
  mode: AiMode;
  local: LocalAiSettings;
  ownKey: OwnKeyAiSettings;
}

export const AI_SETTINGS_STORAGE_KEY = "smartbudget.ai-settings";

export const DEFAULT_LOCAL_AI_SETTINGS: LocalAiSettings = {
  baseUrl: "http://localhost:11434/v1",
  model: "llama3.1:8b",
  visionModel: "gemma4:26b",
  jsonMode: true,
  // Modelele locale de viziune se pot încărca minute întregi la prima folosire.
  timeoutSeconds: 300,
};

export const AI_PROVIDER_PRESETS: Record<
  AiProviderId,
  { label: string; settings: LocalAiSettings }
> = {
  openai: {
    label: "OpenAI",
    settings: {
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      visionModel: "gpt-4o-mini",
      jsonMode: true,
      timeoutSeconds: 60,
    },
  },
  groq: {
    label: "Groq",
    settings: {
      baseUrl: "https://api.groq.com/openai/v1",
      model: "llama-3.3-70b-versatile",
      visionModel: "meta-llama/llama-4-scout-17b-16e-instruct",
      jsonMode: true,
      timeoutSeconds: 60,
    },
  },
  gemini: {
    label: "Google Gemini",
    settings: {
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: "gemini-2.0-flash",
      visionModel: "gemini-2.0-flash",
      jsonMode: true,
      timeoutSeconds: 60,
    },
  },
  custom: {
    label: "Alt furnizor (compatibil OpenAI)",
    settings: {
      baseUrl: "https://",
      model: "",
      visionModel: "",
      jsonMode: true,
      timeoutSeconds: 60,
    },
  },
};

export const DEFAULT_OWN_KEY_AI_SETTINGS: OwnKeyAiSettings = {
  provider: "openai",
  apiKey: "",
  ...AI_PROVIDER_PRESETS.openai.settings,
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  mode: "server",
  local: DEFAULT_LOCAL_AI_SETTINGS,
  ownKey: DEFAULT_OWN_KEY_AI_SETTINGS,
};

export const MIN_TIMEOUT_SECONDS = 10;
export const MAX_TIMEOUT_SECONDS = 600;

/** Elimină spațiile și `/` final, ca `${baseUrl}/chat/completions` să fie corect. */
export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function isValidBaseUrl(value: string): boolean {
  try {
    const url = new URL(normalizeBaseUrl(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function parseEndpoint(
  raw: Record<string, unknown>,
  defaults: LocalAiSettings,
): LocalAiSettings {
  const timeout = Number(raw.timeoutSeconds);
  const baseUrl = text(raw.baseUrl, defaults.baseUrl);
  return {
    baseUrl: isValidBaseUrl(baseUrl)
      ? normalizeBaseUrl(baseUrl)
      : defaults.baseUrl,
    model: text(raw.model, defaults.model),
    visionModel:
      typeof raw.visionModel === "string"
        ? raw.visionModel.trim()
        : defaults.visionModel,
    jsonMode:
      typeof raw.jsonMode === "boolean" ? raw.jsonMode : defaults.jsonMode,
    timeoutSeconds:
      Number.isFinite(timeout) &&
      timeout >= MIN_TIMEOUT_SECONDS &&
      timeout <= MAX_TIMEOUT_SECONDS
        ? Math.round(timeout)
        : defaults.timeoutSeconds,
  };
}

/** Acceptă orice valoare citită din storage și întoarce setări valide, completând ce lipsește. */
export function parseAiSettings(raw: unknown): AiSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_AI_SETTINGS;
  const source = raw as {
    mode?: unknown;
    local?: Record<string, unknown>;
    ownKey?: Record<string, unknown>;
  };
  const ownKey = source.ownKey ?? {};
  const provider: AiProviderId =
    typeof ownKey.provider === "string" && ownKey.provider in AI_PROVIDER_PRESETS
      ? (ownKey.provider as AiProviderId)
      : DEFAULT_OWN_KEY_AI_SETTINGS.provider;
  return {
    mode:
      source.mode === "local" || source.mode === "own-key"
        ? source.mode
        : "server",
    local: parseEndpoint(source.local ?? {}, DEFAULT_LOCAL_AI_SETTINGS),
    ownKey: {
      ...parseEndpoint(ownKey, AI_PROVIDER_PRESETS[provider].settings),
      provider,
      apiKey: typeof ownKey.apiKey === "string" ? ownKey.apiKey.trim() : "",
    },
  };
}

/** Setările pentru apelurile făcute din browser; `null` când AI-ul rulează în backend. */
export function getBrowserAiConfig(settings: AiSettings): BrowserAiConfig | null {
  // Modelul pentru bonuri este opțional: gol înseamnă același model ca la recomandări.
  const withVision = <T extends LocalAiSettings>(endpoint: T): T => ({
    ...endpoint,
    visionModel: endpoint.visionModel || endpoint.model,
  });
  if (settings.mode === "local") return withVision(settings.local);
  if (settings.mode === "own-key") {
    const { provider: _provider, apiKey, ...endpoint } = settings.ownKey;
    return { ...withVision(endpoint), apiKey };
  }
  return null;
}

const listeners = new Set<() => void>();
let cache: { raw: string | null; settings: AiSettings } | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Referința întoarsă rămâne aceeași cât timp valoarea din storage nu se schimbă. */
export function loadAiSettings(): AiSettings {
  const raw = readRaw();
  if (cache && cache.raw === raw) return cache.settings;
  let settings = DEFAULT_AI_SETTINGS;
  if (raw) {
    try {
      settings = parseAiSettings(JSON.parse(raw));
    } catch {
      settings = DEFAULT_AI_SETTINGS;
    }
  }
  cache = { raw, settings };
  return settings;
}

export function saveAiSettings(settings: AiSettings): void {
  window.localStorage.setItem(
    AI_SETTINGS_STORAGE_KEY,
    JSON.stringify(parseAiSettings(settings)),
  );
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useAiSettings(): AiSettings {
  return useSyncExternalStore(subscribe, loadAiSettings, () => DEFAULT_AI_SETTINGS);
}
