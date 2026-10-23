import type { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "../errors";
import { http } from "../http";
import { getBudgetLevelFromStatus } from "../../utils/budget";
import { getGoalDisplayStatus } from "../../utils/goal";
import { httpAiInsightsApi, toAiInsightsResponse } from "./aiInsightsApi";
import { httpBudgetsApi } from "./budgetsApi";
import { httpDashboardApi } from "./dashboardApi";
import { httpGoalsApi } from "./goalsApi";
import { httpTransactionsApi } from "./transactionsApi";

type Handler = (config: InternalAxiosRequestConfig) => {
  status: number;
  data: unknown;
};

const originalAdapter = http.defaults.adapter;
let calls: InternalAxiosRequestConfig[] = [];

function mockBackend(handler: Handler) {
  http.defaults.adapter = async (config) => {
    calls.push(config);
    const { status, data } = handler(config);
    const response = {
      data,
      status,
      statusText: String(status),
      headers: {},
      config,
    };
    if (status >= 400) {
      const { AxiosError } = await import("axios");
      throw new AxiosError("fail", String(status), config, null, response);
    }
    return response;
  };
}

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  http.defaults.adapter = originalAdapter as AxiosRequestConfig["adapter"];
});

describe("contract HTTP față de backend", () => {
  it("trimite filtrele tranzacțiilor ca parametri și păstrează id-uri string", async () => {
    mockBackend(() => ({
      status: 200,
      data: {
        content: [
          {
            id: "6ad9cecab0170ab0a1d1a8d0",
            type: "EXPENSE",
            amount: 12.5,
            description: "Cafea",
            transactionDate: "2026-10-05",
            categoryId: "demo-cat-restaurants",
            categoryName: "Restaurante",
          },
        ],
        page: 0,
        size: 10,
        totalElements: 1,
        totalPages: 1,
      },
    }));

    const page = await httpTransactionsApi.list({
      page: 0,
      size: 10,
      type: "EXPENSE",
      categoryId: "demo-cat-restaurants",
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      search: "  cafea ",
      sortBy: "transactionDate",
      sortDir: "desc",
    });

    expect(calls[0]?.url).toBe("/transactions");
    expect(calls[0]?.params).toMatchObject({
      categoryId: "demo-cat-restaurants",
      search: "cafea",
      sort: "transactionDate,desc",
    });
    expect(calls[0]?.params).not.toHaveProperty("sortBy");
    expect(page.content[0]?.id).toBe("6ad9cecab0170ab0a1d1a8d0");
  });

  it("creează și editează tranzacții cu categoryId string", async () => {
    mockBackend(() => ({ status: 200, data: {} }));
    const input = {
      type: "EXPENSE" as const,
      amount: 10,
      description: "Test",
      transactionDate: "2026-10-05",
      categoryId: "demo-cat-groceries",
    };
    await httpTransactionsApi.create(input);
    await httpTransactionsApi.update("abc123", input);
    await httpTransactionsApi.remove("abc123");

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "post /transactions",
      "put /transactions/abc123",
      "delete /transactions/abc123",
    ]);
    expect(JSON.parse(String(calls[0]?.data))).toEqual(input);
  });

  it("trimite rândurile importului la verificarea dublurilor și întoarce indicii", async () => {
    mockBackend(() => ({ status: 200, data: { indexes: [1] } }));
    const items = [
      {
        index: 1,
        type: "EXPENSE" as const,
        amount: 12.5,
        description: "Cafea",
        transactionDate: "2026-10-05",
      },
    ];

    const result = await httpTransactionsApi.findExisting(items);

    expect(calls[0]?.method).toBe("post");
    expect(calls[0]?.url).toBe("/transactions/import/existing");
    expect(JSON.parse(String(calls[0]?.data))).toEqual({ items });
    expect(result).toEqual([1]);
  });

  it("trimite bugetul și contribuția în formatul așteptat de backend", async () => {
    mockBackend(() => ({ status: 201, data: {} }));
    await httpBudgetsApi.create({
      categoryId: "demo-cat-health",
      month: "2026-10",
      limitAmount: 200,
    });
    await httpGoalsApi.create({
      name: "Vacanță",
      targetAmount: 1000,
      targetDate: "2027-01-01",
    });
    await httpGoalsApi.contribute("g1", { amount: 50 });

    expect(JSON.parse(String(calls[0]?.data))).toEqual({
      categoryId: "demo-cat-health",
      month: "2026-10",
      limitAmount: 200,
    });
    expect(calls[2]?.url).toBe("/goals/g1/contributions");
    expect(JSON.parse(String(calls[2]?.data))).toEqual({ amount: 50 });
  });

  it("trimite parametrul year pentru perioade anuale și month pentru lunare", async () => {
    mockBackend(() => ({ status: 200, data: [] }));
    await httpBudgetsApi.list("2026");
    await httpBudgetsApi.list("2026-10");
    await httpDashboardApi.get("2026");

    expect(calls[0]?.params).toEqual({ year: 2026 });
    expect(calls[1]?.params).toEqual({ month: "2026-10" });
    expect(calls[2]?.url).toBe("/dashboard");
    expect(calls[2]?.params).toEqual({ year: 2026 });
  });

  it("mapează insights-urile AI ale backendului în recomandări", async () => {
    mockBackend(() => ({
      status: 200,
      data: {
        month: "2026-10",
        summary: "Rezumat",
        insights: [
          {
            title: "Redu restaurantele",
            reason: "Peste 80% din buget",
            suggestedMonthlySaving: 120.5,
            priority: "HIGH",
          },
        ],
        generatedAt: "2026-10-22T08:00:00Z",
      },
    }));

    const result = await httpAiInsightsApi.analyze({ month: "2026-10" });

    expect(calls[0]?.url).toBe("/ai/insights");
    expect(JSON.parse(String(calls[0]?.data))).toEqual({ month: "2026-10" });
    expect(result.recommendations).toEqual([
      {
        id: "2026-10-0",
        title: "Redu restaurantele",
        explanation: "Peste 80% din buget",
        priority: "HIGH",
        estimatedMonthlySavings: 120.5,
      },
    ]);
  });

  it("respinge un răspuns AI fără insights", () => {
    expect(() =>
      toAiInsightsResponse({ summary: "x", generatedAt: "now" } as never),
    ).toThrow(ApiError);
  });

  it("propagă mesajul și erorile de câmp ale backendului", async () => {
    mockBackend(() => ({
      status: 400,
      data: {
        status: 400,
        message: "Datele trimise nu sunt valide.",
        fieldErrors: { amount: "Suma trebuie să fie pozitivă" },
      },
    }));

    const error = await httpBudgetsApi
      .create({ categoryId: "x", month: "2026-10", limitAmount: -1 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).fieldErrors).toEqual({
      amount: "Suma trebuie să fie pozitivă",
    });
  });

  it("afișează un mesaj clar când gateway-ul returnează 502 fără JSON", async () => {
    mockBackend(() => ({ status: 502, data: "<html>Bad Gateway</html>" }));
    const error = (await httpGoalsApi.list().catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(502);
    expect(error.message).toMatch(/nu este disponibil/);
  });
});

describe("stări derivate", () => {
  it("folosește statusul backendului pentru nivelul bugetului", () => {
    expect(getBudgetLevelFromStatus({ status: "NORMAL" })).toBe("ok");
    expect(getBudgetLevelFromStatus({ status: "WARNING" })).toBe("warning");
    expect(getBudgetLevelFromStatus({ status: "EXCEEDED" })).toBe("exceeded");
  });

  it("deduce termenul depășit doar pentru obiective active cu dată trecută", () => {
    expect(
      getGoalDisplayStatus({ status: "ACTIVE", targetDate: "2000-01-01" }),
    ).toBe("OVERDUE");
    expect(
      getGoalDisplayStatus({ status: "COMPLETED", targetDate: "2000-01-01" }),
    ).toBe("COMPLETED");
    expect(getGoalDisplayStatus({ status: "ACTIVE", targetDate: null })).toBe(
      "ACTIVE",
    );
  });
});
