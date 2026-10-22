import type { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_LOCAL_AI_SETTINGS,
  saveAiSettings,
} from "../../config/aiSettings";
import { ApiError } from "../errors";
import { http } from "../http";
import {
  listLocalModels,
  localAiInsightsApi,
  localScanTransaction,
} from "./localAiApi";

const originalAdapter = http.defaults.adapter;
let backendCalls: { method?: string; url?: string; body: unknown }[] = [];

function mockBackend(
  routes: Record<string, unknown>,
) {
  http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const key = `${config.method?.toUpperCase()} ${config.url}`;
    backendCalls.push({
      method: config.method,
      url: config.url,
      body: config.data ? JSON.parse(config.data as string) : undefined,
    });
    return {
      data: routes[key],
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
}

function modelAnswer(content: unknown, ok = true) {
  return vi.fn(async () =>
    new Response(
      JSON.stringify(
        ok ? { choices: [{ message: { content } }] } : content,
      ),
      { status: ok ? 200 : 404 },
    ),
  );
}

beforeEach(() => {
  backendCalls = [];
  saveAiSettings({
    ...DEFAULT_AI_SETTINGS,
    mode: "local",
    local: { ...DEFAULT_LOCAL_AI_SETTINGS, model: "m1", visionModel: "v1" },
  });
});

afterEach(() => {
  http.defaults.adapter = originalAdapter as AxiosRequestConfig["adapter"];
  vi.unstubAllGlobals();
});

describe("AI local apelat din browser", () => {
  it("cere promptul de la backend, apelează modelul local și validează răspunsul în backend", async () => {
    mockBackend({
      "POST /ai/local/insights/prompt": {
        period: "2026-09",
        systemPrompt: "sistem",
        userMessage: "date",
      },
      "POST /ai/local/insights/result": {
        month: "2026-09",
        summary: "Rezumat",
        insights: [
          {
            title: "T",
            reason: "R",
            suggestedMonthlySaving: 50,
            priority: "HIGH",
          },
        ],
        generatedAt: "2026-10-22T10:00:00Z",
      },
    });
    const fetchMock = modelAnswer('{"summary":"x"}');
    vi.stubGlobal("fetch", fetchMock);

    const result = await localAiInsightsApi.analyze({ month: "2026-09" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    const sent = JSON.parse(init.body as string);
    expect(sent.model).toBe("m1");
    expect(sent.response_format).toEqual({ type: "json_object" });
    expect(sent.messages).toEqual([
      { role: "system", content: "sistem" },
      { role: "user", content: "date" },
    ]);
    expect(backendCalls[1]?.body).toEqual({
      month: "2026-09",
      content: '{"summary":"x"}',
    });
    expect(result.summary).toBe("Rezumat");
    expect(result.recommendations[0]?.estimatedMonthlySavings).toBe(50);
  });

  it("validează o analiză anuală cu anul din prompt", async () => {
    mockBackend({
      "POST /ai/local/insights/prompt": {
        period: "2026",
        systemPrompt: "s",
        userMessage: "u",
      },
      "POST /ai/local/insights/result": {
        month: "2026",
        summary: "An",
        insights: [],
        generatedAt: "2026-10-22T10:00:00Z",
      },
    });
    vi.stubGlobal("fetch", modelAnswer("{}"));

    await localAiInsightsApi.analyze({ year: 2026 });

    expect(backendCalls[1]?.body).toEqual({ year: 2026, content: "{}" });
  });

  it("trimite poza ca data URL la modelul de vision", async () => {
    mockBackend({
      "GET /ai/local/receipt/prompt": { systemPrompt: "bon", userText: "citește" },
      "POST /ai/local/receipt/result": {
        type: "EXPENSE",
        amount: 12.5,
        description: "Lidl",
        transactionDate: "2026-10-20",
        categoryId: null,
      },
    });
    const fetchMock = modelAnswer("{}");
    vi.stubGlobal("fetch", fetchMock);

    const scan = await localScanTransaction(
      new Blob(["abc"], { type: "image/png" }),
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(sent.model).toBe("v1");
    expect(sent.messages[1].content[0]).toEqual({ type: "text", text: "citește" });
    expect(sent.messages[1].content[1].image_url.url).toMatch(
      /^data:image\/png;base64,/,
    );
    expect(scan.amount).toBe(12.5);
  });

  it("explică lipsa conexiunii la modelul local", async () => {
    mockBackend({
      "POST /ai/local/insights/prompt": {
        period: "2026-09",
        systemPrompt: "s",
        userMessage: "u",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(
      localAiInsightsApi.analyze({ month: "2026-09" }),
    ).rejects.toThrow(/Nu s-a putut contacta modelul local/);
  });

  it("afișează eroarea modelului (ex. model lipsă) fără să apeleze validarea", async () => {
    mockBackend({
      "POST /ai/local/insights/prompt": {
        period: "2026-09",
        systemPrompt: "s",
        userMessage: "u",
      },
    });
    vi.stubGlobal(
      "fetch",
      modelAnswer({ error: { message: 'model "m1" not found' } }, false),
    );

    const failure = localAiInsightsApi.analyze({ month: "2026-09" });

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toThrow(/model "m1" not found/);
    expect(backendCalls).toHaveLength(1);
  });

  it("cu cheie proprie apelează furnizorul cu Authorization și nu trimite cheia backendului", async () => {
    saveAiSettings({
      ...DEFAULT_AI_SETTINGS,
      mode: "own-key",
      ownKey: {
        ...DEFAULT_AI_SETTINGS.ownKey,
        apiKey: "sk-test-123",
        model: "gpt-x",
      },
    });
    mockBackend({
      "POST /ai/local/insights/prompt": {
        period: "2026-09",
        systemPrompt: "s",
        userMessage: "u",
      },
      "POST /ai/local/insights/result": {
        month: "2026-09",
        summary: "ok",
        insights: [],
        generatedAt: "2026-10-22T10:00:00Z",
      },
    });
    const fetchMock = modelAnswer("{}");
    vi.stubGlobal("fetch", fetchMock);

    await localAiInsightsApi.analyze({ month: "2026-09" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk-test-123",
    );
    expect(JSON.parse(init.body as string).model).toBe("gpt-x");
    expect(JSON.stringify(backendCalls)).not.toContain("sk-test-123");
  });

  it("explică o cheie respinsă fără a o afișa", async () => {
    saveAiSettings({
      ...DEFAULT_AI_SETTINGS,
      mode: "own-key",
      ownKey: { ...DEFAULT_AI_SETTINGS.ownKey, apiKey: "sk-secret-999" },
    });
    mockBackend({
      "POST /ai/local/insights/prompt": {
        period: "2026-09",
        systemPrompt: "s",
        userMessage: "u",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "Incorrect API key" } }), {
          status: 401,
        }),
      ),
    );

    const failure = localAiInsightsApi.analyze({ month: "2026-09" });

    await expect(failure).rejects.toThrow(/Cheia API pare invalidă/);
    await expect(failure).rejects.not.toThrow(/sk-secret-999/);
  });

  it("listează modelele disponibile, sortate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ data: [{ id: "b" }, { id: "a" }] })),
      ),
    );

    expect(await listLocalModels(DEFAULT_LOCAL_AI_SETTINGS)).toEqual(["a", "b"]);
  });
});
