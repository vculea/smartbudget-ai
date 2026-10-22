import { describe, expect, it } from "vitest";
import {
  AI_PROVIDER_PRESETS,
  AI_SETTINGS_STORAGE_KEY,
  DEFAULT_AI_SETTINGS,
  DEFAULT_OWN_KEY_AI_SETTINGS,
  getBrowserAiConfig,
  isValidBaseUrl,
  loadAiSettings,
  normalizeBaseUrl,
  parseAiSettings,
  saveAiSettings,
} from "./aiSettings";

describe("aiSettings", () => {
  it("folosește serverul ca mod implicit", () => {
    expect(loadAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
    expect(loadAiSettings().mode).toBe("server");
  });

  it("salvează și reîncarcă setările locale, normalizând adresa", () => {
    saveAiSettings({
      mode: "local",
      local: {
        baseUrl: " http://localhost:11434/v1/ ",
        model: "llama3.1:8b",
        visionModel: "llava",
        jsonMode: false,
        timeoutSeconds: 90,
      },
      ownKey: DEFAULT_OWN_KEY_AI_SETTINGS,
    });

    expect(loadAiSettings()).toEqual({
      mode: "local",
      local: {
        baseUrl: "http://localhost:11434/v1",
        model: "llama3.1:8b",
        visionModel: "llava",
        jsonMode: false,
        timeoutSeconds: 90,
      },
      ownKey: DEFAULT_OWN_KEY_AI_SETTINGS,
    });
  });

  it("salvează cheia proprie și o expune doar pentru apelurile din browser", () => {
    saveAiSettings({
      ...DEFAULT_AI_SETTINGS,
      mode: "own-key",
      ownKey: {
        ...DEFAULT_OWN_KEY_AI_SETTINGS,
        provider: "groq",
        apiKey: "  gsk-secret  ",
        baseUrl: AI_PROVIDER_PRESETS.groq.settings.baseUrl,
      },
    });

    const settings = loadAiSettings();
    expect(settings.mode).toBe("own-key");
    expect(settings.ownKey.apiKey).toBe("gsk-secret");
    expect(getBrowserAiConfig(settings)).toMatchObject({
      apiKey: "gsk-secret",
      baseUrl: "https://api.groq.com/openai/v1",
    });
    expect(getBrowserAiConfig({ ...settings, mode: "server" })).toBeNull();
    expect(getBrowserAiConfig({ ...settings, mode: "local" })?.apiKey).toBeUndefined();
  });

  it("folosește modelul de recomandări și pentru bonuri când cel pentru bonuri e gol", () => {
    saveAiSettings({
      ...DEFAULT_AI_SETTINGS,
      mode: "local",
      local: {
        ...DEFAULT_AI_SETTINGS.local,
        model: "gemma4:26b",
        visionModel: "",
      },
    });

    const settings = loadAiSettings();
    expect(settings.local.visionModel).toBe("");
    expect(getBrowserAiConfig(settings)?.visionModel).toBe("gemma4:26b");
  });

  it("ignoră un furnizor necunoscut din storage", () => {
    const settings = parseAiSettings({
      mode: "own-key",
      ownKey: { provider: "necunoscut", apiKey: 123 },
    });
    expect(settings.ownKey.provider).toBe("openai");
    expect(settings.ownKey.apiKey).toBe("");
  });

  it("întoarce aceeași referință cât timp valoarea nu se schimbă", () => {
    expect(loadAiSettings()).toBe(loadAiSettings());
  });

  it("ignoră valorile corupte din storage", () => {
    window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, "{nu e json");
    expect(loadAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
  });

  it("completează câmpurile invalide cu valorile implicite", () => {
    const settings = parseAiSettings({
      mode: "cloud",
      local: { baseUrl: "ftp://x", model: " ", timeoutSeconds: 5 },
    });
    expect(settings).toEqual(DEFAULT_AI_SETTINGS);
  });

  it("validează adresa serverului AI", () => {
    expect(isValidBaseUrl("http://localhost:11434/v1")).toBe(true);
    expect(isValidBaseUrl("https://ollama.exemplu.ro/v1/")).toBe(true);
    expect(isValidBaseUrl("localhost:11434")).toBe(false);
    expect(isValidBaseUrl("javascript:alert(1)")).toBe(false);
    expect(normalizeBaseUrl("http://a/v1//")).toBe("http://a/v1");
  });
});
