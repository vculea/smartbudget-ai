import type { AiInsightsApi, TransactionImportAiApi, TransactionsApi } from "../contracts";
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
  ImportCategorySuggestion,
  ImportColumnMapping,
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

async function request(
  url: string,
  init: RequestInit,
  config: BrowserAiConfig,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    config.timeoutSeconds * 1000,
  );
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(
        "Modelul AI a răspuns prea greu. Mărește timpul de așteptare din Setări AI sau alege un model mai mic.",
        504,
      );
    }
    throw new ApiError(
      config.apiKey
        ? `Nu s-a putut contacta furnizorul AI la ${config.baseUrl}. Verifică adresa și conexiunea la internet.`
        : `Nu s-a putut contacta modelul local la ${config.baseUrl}. Verifică dacă Ollama rulează și dacă OLLAMA_ORIGINS permite acest site (vezi Setări AI).`,
      0,
    );
  } finally {
    clearTimeout(timer);
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

async function chat(
  config: BrowserAiConfig,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  const body: Record<string, unknown> = { model, messages, stream: false };
  if (config.jsonMode) body.response_format = { type: "json_object" };

  const response = await request(
    `${normalizeBaseUrl(config.baseUrl)}/chat/completions`,
    { method: "POST", headers: headers(config), body: JSON.stringify(body) },
    config,
  );
  if (!response.ok) {
    const detail = await providerMessage(response);
    throw new ApiError(
      `Modelul AI a răspuns cu eroare (cod ${response.status})${detail ? `: ${detail}` : ""}.${statusHint(response.status, !!config.apiKey)}`,
      502,
    );
  }
  const json = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: unknown } }[];
  } | null;
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new ApiError(
      "Modelul AI a returnat un răspuns gol. Încearcă din nou.",
      502,
    );
  }
  return content;
}

/** Numele modelelor disponibile la `baseUrl`; folosit la „Testează conexiunea”. */
export async function listLocalModels(
  config: BrowserAiConfig,
): Promise<string[]> {
  const response = await request(
    `${normalizeBaseUrl(config.baseUrl)}/models`,
    { method: "GET", headers: headers(config) },
    { ...config, timeoutSeconds: 10 },
  );
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

export const localScanTransaction: TransactionsApi["scan"] = async (image) => {
  const settings = activeConfig();
  const { data: prompt } = await http.get<LocalReceiptPrompt>(
    "/ai/local/receipt/prompt",
  );
  const content = await chat(settings, settings.visionModel, [
    { role: "system", content: prompt.systemPrompt },
    {
      role: "user",
      content: [
        { type: "text", text: prompt.userText },
        { type: "image_url", image_url: { url: await blobToDataUrl(image) } },
      ],
    },
  ]);
  const { data } = await http.post<TransactionScan>(
    "/ai/local/receipt/result",
    { content },
  );
  return data;
};
