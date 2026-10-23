import type {
  AiInsightsApi,
  BudgetPlanAiApi,
  TransactionImportAiApi,
  TransactionsApi,
} from "../contracts";
import { ApiError } from "../errors";
import { http } from "../http";
import {
  getBrowserAiConfig,
  loadAiSettings,
  normalizeBaseUrl,
  type BrowserAiConfig,
} from "../../config/aiSettings";
import { toAiInsightsResponse, type AiInsightsWire } from "./aiInsightsApi";
import type {
  BudgetPlan,
  ImportCategorySuggestion,
  ImportColumnMapping,
  ScanProgress,
  TransactionScan,
} from "../../types";

/** Prompturile construite de backend; modelul primește doar rezumatul agregat. */
interface LocalInsightsPrompt {
  period: string;
  systemPrompt: string;
  userMessage: string;
}

interface LocalReceiptPrompt {
  systemPrompt: string;
  userText: string;
}

type ChatMessage = {
  role: "system" | "user";
  content: string | Array<Record<string, unknown>>;
};

/** Setările activate în „Setări AI” pentru apelurile din browser (model local sau cheie proprie). */
function activeConfig(): BrowserAiConfig {
  const config = getBrowserAiConfig(loadAiSettings());
  if (!config) {
    throw new ApiError("Alege un model local sau o cheie proprie în Setări AI.", 0);
  }
  return config;
}

/** Primele caractere din eroarea întoarsă de model (ex. „model not found”), fără a expune corpuri mari. */
async function providerMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string } | string;
    };
    const message =
      typeof body.error === "string" ? body.error : body.error?.message;
    return message ? message.slice(0, 200) : "";
  } catch {
    return "";
  }
}

function headers(config: BrowserAiConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
  };
}

/**
 * Anulează cererea când modelul nu trimite nimic timp de `timeoutSeconds`. Fiecare bucată primită
 * (`touch`) repornește numărătoarea, deci un răspuns lung care curge nu este întrerupt.
 */
interface IdleGuard {
  signal: AbortSignal;
  touch(): void;
  timedOut(): boolean;
  dispose(): void;
}

function idleGuard(timeoutSeconds: number, external?: AbortSignal): IdleGuard {
  const controller = new AbortController();
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const touch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      expired = true;
      controller.abort();
    }, timeoutSeconds * 1000);
  };
  const cancel = () => controller.abort();
  if (external?.aborted) cancel();
  else external?.addEventListener("abort", cancel, { once: true });
  touch();
  return {
    signal: controller.signal,
    touch,
    timedOut: () => expired,
    dispose: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", cancel);
    },
  };
}

/** Oprirea cerută de utilizator; interfața nu o afișează ca eroare. */
const AI_REQUEST_CANCELLED = "Citirea a fost anulată.";

function requestError(
  error: unknown,
  config: BrowserAiConfig,
  guard: IdleGuard,
): unknown {
  if (error instanceof ApiError) return error;
  if (guard.signal.aborted) {
    return guard.timedOut()
      ? new ApiError(
          `Modelul AI nu a trimis nimic timp de ${config.timeoutSeconds} de secunde. Mărește „Timp maxim fără răspuns” din Setări AI sau alege un model mai mic.`,
          504,
        )
      : new ApiError(AI_REQUEST_CANCELLED, 0);
  }
  return new ApiError(
    config.apiKey
      ? `Nu s-a putut contacta furnizorul AI la ${config.baseUrl}. Verifică adresa și conexiunea la internet.`
      : `Nu s-a putut contacta modelul local la ${config.baseUrl}. Verifică dacă Ollama rulează și dacă OLLAMA_ORIGINS permite acest site (vezi Setări AI).`,
    0,
  );
}

async function send(
  url: string,
  init: RequestInit,
  config: BrowserAiConfig,
  guard: IdleGuard,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: guard.signal });
  } catch (error) {
    throw requestError(error, config, guard);
  }
}

/** Mesaj clar pentru erorile frecvente; nu include niciodată cheia. */
function statusHint(status: number, hasKey: boolean): string {
  if (hasKey && (status === 401 || status === 403)) {
    return " Cheia API pare invalidă sau fără acces la model; verific-o în Setări AI.";
  }
  if (status === 429) {
    return " Limita furnizorului a fost atinsă sau contul nu are credit.";
  }
  return "";
}

interface ChatOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ScanProgress) => void;
}

type StreamChunk = {
  choices?: {
    delta?: { content?: unknown; reasoning?: unknown; reasoning_content?: unknown };
  }[];
  error?: { message?: string } | string;
};

function emptyAnswer(): ApiError {
  return new ApiError("Modelul AI a returnat un răspuns gol. Încearcă din nou.", 502);
}

/**
 * Citește răspunsul trimis în flux (SSE, `data: {...}`), bucată cu bucată. Dacă furnizorul a ignorat
 * `stream: true` și a răspuns cu un JSON obișnuit, îl citește pe acela.
 */
async function readCompletion(
  response: Response,
  guard: IdleGuard,
  onProgress?: ChatOptions["onProgress"],
): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.body || !contentType.includes("text/event-stream")) {
    const json = (await response.json().catch(() => null)) as {
      choices?: { message?: { content?: unknown } }[];
    } | null;
    const content = json?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let chunk: StreamChunk;
    try {
      chunk = JSON.parse(payload) as StreamChunk;
    } catch {
      return;
    }
    if (chunk.error) {
      const message =
        typeof chunk.error === "string" ? chunk.error : chunk.error.message;
      throw new ApiError(
        `Modelul AI a răspuns cu eroare${message ? `: ${message.slice(0, 200)}` : ""}.`,
        502,
      );
    }
    const delta = chunk.choices?.[0]?.delta;
    if (typeof delta?.content === "string" && delta.content) {
      content += delta.content;
      onProgress?.({ phase: "writing", receivedChars: content.length });
    } else if (
      (typeof delta?.reasoning === "string" && delta.reasoning) ||
      (typeof delta?.reasoning_content === "string" && delta.reasoning_content)
    ) {
      onProgress?.({ phase: "thinking", receivedChars: content.length });
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    guard.touch();
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handleLine);
  }
  handleLine(buffer + decoder.decode());
  return content;
}

async function chat(
  config: BrowserAiConfig,
  model: string,
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  // În flux, modelul trimite răspunsul pe măsură ce îl scrie: timpul de așteptare se aplică doar pauzelor.
  const body: Record<string, unknown> = { model, messages, stream: true };
  if (config.jsonMode) body.response_format = { type: "json_object" };

  const guard = idleGuard(config.timeoutSeconds, options.signal);
  try {
    options.onProgress?.({ phase: "waiting", receivedChars: 0 });
    const response = await send(
      `${normalizeBaseUrl(config.baseUrl)}/chat/completions`,
      { method: "POST", headers: headers(config), body: JSON.stringify(body) },
      config,
      guard,
    );
    if (!response.ok) {
      const detail = await providerMessage(response);
      throw new ApiError(
        `Modelul AI a răspuns cu eroare (cod ${response.status})${detail ? `: ${detail}` : ""}.${statusHint(response.status, !!config.apiKey)}`,
        502,
      );
    }
    const content = await readCompletion(response, guard, options.onProgress);
    if (!content.trim()) throw emptyAnswer();
    return content;
  } catch (error) {
    throw requestError(error, config, guard);
  } finally {
    guard.dispose();
  }
}

/** Numele modelelor disponibile la `baseUrl`; folosit la „Testează conexiunea”. */
export async function listLocalModels(
  config: BrowserAiConfig,
): Promise<string[]> {
  const guard = idleGuard(10);
  let response: Response;
  try {
    response = await send(
      `${normalizeBaseUrl(config.baseUrl)}/models`,
      { method: "GET", headers: headers(config) },
      { ...config, timeoutSeconds: 10 },
      guard,
    );
  } finally {
    guard.dispose();
  }
  if (!response.ok) {
    throw new ApiError(
      `Serverul AI a răspuns cu eroare (cod ${response.status}).${statusHint(response.status, !!config.apiKey)}`,
      502,
    );
  }
  const json = (await response.json().catch(() => null)) as {
    data?: { id?: unknown }[];
  } | null;
  return (json?.data ?? [])
    .map((model) => model.id)
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.replace(/^models\//, ""))
    .sort();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new ApiError("Imaginea nu a putut fi citită.", 0));
    reader.readAsDataURL(blob);
  });
}

// Backendul calculează cifrele și validează răspunsul; doar apelul către model (local sau cu cheia proprie) pornește din browser.
export const localAiInsightsApi: AiInsightsApi = {
  async analyze(period) {
    const settings = activeConfig();
    const { data: prompt } = await http.post<LocalInsightsPrompt>(
      "/ai/local/insights/prompt",
      period,
    );
    const content = await chat(settings, settings.model, [
      { role: "system", content: prompt.systemPrompt },
      { role: "user", content: prompt.userMessage },
    ]);
    // Validarea folosește exact perioada pentru care s-a construit promptul.
    const validated = /^\d{4}-\d{2}$/.test(prompt.period)
      ? { month: prompt.period }
      : { year: Number(prompt.period) };
    const { data } = await http.post<AiInsightsWire>(
      "/ai/local/insights/result",
      { ...validated, content },
    );
    return toAiInsightsResponse(data);
  },
};

interface ImportPrompt {
  systemPrompt: string;
  userMessage: string;
}

// Backendul calculează mediile și validează limitele propuse; doar apelul către model pornește din browser.
export const localBudgetPlanAiApi: BudgetPlanAiApi = {
  async suggest(year) {
    const settings = activeConfig();
    const { data: prompt } = await http.post<ImportPrompt>(
      "/ai/local/budget-plan/prompt",
      { year },
    );
    const content = await chat(settings, settings.model, [
      { role: "system", content: prompt.systemPrompt },
      { role: "user", content: prompt.userMessage },
    ]);
    const { data } = await http.post<BudgetPlan>(
      "/ai/local/budget-plan/result",
      { year, content },
    );
    return data;
  },
};

// Backendul construiește prompturile și validează răspunsul; doar apelul către model pornește din browser.
export const localImportAiApi: TransactionImportAiApi = {
  async detectColumns(rows) {
    const settings = activeConfig();
    const { data: prompt } = await http.post<ImportPrompt>(
      "/transactions/import/columns/prompt",
      { rows },
    );
    const content = await chat(settings, settings.model, [
      { role: "system", content: prompt.systemPrompt },
      { role: "user", content: prompt.userMessage },
    ]);
    const { data } = await http.post<ImportColumnMapping>(
      "/transactions/import/columns/result",
      {
        content,
        columnCount: Math.max(1, ...rows.map((row) => row.length)),
      },
    );
    return data;
  },
  async suggestCategories(items) {
    const settings = activeConfig();
    const { data: prompt } = await http.post<ImportPrompt>(
      "/transactions/import/categories/prompt",
      { items },
    );
    const content = await chat(settings, settings.model, [
      { role: "system", content: prompt.systemPrompt },
      { role: "user", content: prompt.userMessage },
    ]);
    const { data } = await http.post<{
      suggestions: ImportCategorySuggestion[];
    }>("/transactions/import/categories/result", { content, items });
    return data.suggestions;
  },
};

export const localScanTransaction: TransactionsApi["scan"] = async (
  image,
  options = {},
) => {
  const settings = activeConfig();
  const { data: prompt } = await http.get<LocalReceiptPrompt>(
    "/ai/local/receipt/prompt",
    { signal: options.signal },
  );
  const content = await chat(
    settings,
    settings.visionModel,
    [
      { role: "system", content: prompt.systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: prompt.userText },
          { type: "image_url", image_url: { url: await blobToDataUrl(image) } },
        ],
      },
    ],
    options,
  );
  const { data } = await http.post<{ transactions: TransactionScan[] }>(
    "/ai/local/receipt/result",
    { content },
    { signal: options.signal },
  );
  return data.transactions;
};
