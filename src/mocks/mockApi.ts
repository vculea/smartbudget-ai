import type {
  AiInsightsApi,
  BudgetPlanAiApi,
  BudgetsApi,
  CategoriesApi,
  CategoryMemoryApi,
  DashboardApi,
  GoalsApi,
  TransactionImportAiApi,
  TransactionsApi,
} from "../api/contracts";
import { ApiError } from "../api/errors";
import { env } from "../config/env";
import type {
  AiRecommendation,
  Budget,
  CategoryExpense,
  CategoryInput,
  DashboardResponse,
  Goal,
  IncomePlan,
  Period,
  Transaction,
  YearMonth,
} from "../types";
import { formatCurrency, formatPercent } from "../utils/format";
import {
  currentMonth,
  formatPeriodLabel,
  isYearPeriod,
  shiftMonth,
  todayIso,
} from "../utils/date";
import {
  CATEGORY,
  type DemoDb,
  type StoredBudget,
  type StoredGoal,
  type StoredTransaction,
} from "./seed";
import { loadDb, saveDb } from "./db";
import {
  forgetMemory,
  learnMemory,
  listMemory,
  matchMemory,
  moveMemoryCategory,
} from "./categoryMemory";

const delay = (factor = 1) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, env.mockLatencyMs * factor);
  });

const round2 = (value: number) => Math.round(value * 100) / 100;

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const sumBy = (items: StoredTransaction[]) =>
  round2(items.reduce((acc, t) => acc + t.amount, 0));

function toTransaction(db: DemoDb, stored: StoredTransaction): Transaction {
  const category = db.categories.find((c) => c.id === stored.categoryId);
  return { ...stored, categoryName: category?.name };
}

function toBudget(db: DemoDb, stored: StoredBudget): Budget {
  const category = db.categories.find((c) => c.id === stored.categoryId);
  const spent = sumBy(
    db.transactions.filter(
      (t) =>
        t.type === "EXPENSE" &&
        t.categoryId === stored.categoryId &&
        t.transactionDate.startsWith(stored.month),
    ),
  );
  return {
    id: stored.id,
    categoryId: stored.categoryId,
    categoryName: category?.name ?? "Necunoscut",
    month: stored.month,
    limitAmount: stored.limitAmount,
    spentAmount: spent,
    remainingAmount: round2(stored.limitAmount - spent),
    percentageUsed:
      stored.limitAmount > 0 ? round2((spent / stored.limitAmount) * 100) : 0,
    status:
      spent > stored.limitAmount
        ? "EXCEEDED"
        : spent >= stored.limitAmount * 0.8
          ? "WARNING"
          : "NORMAL",
  };
}

const categoryType = (db: DemoDb, categoryId: string) =>
  db.categories.find((c) => c.id === categoryId)?.type;

/** Ca în backend: bugetele pe categorii de venit sunt venituri planificate, listate separat. */
const isExpenseBudget = (db: DemoDb, b: StoredBudget) =>
  categoryType(db, b.categoryId) !== "INCOME";

/** Pentru un an, sumele aceleiași categorii sunt însumate pe toate lunile. */
function storedForPeriod(
  db: DemoDb,
  period: Period,
  keep: (b: StoredBudget) => boolean,
): StoredBudget[] {
  if (!isYearPeriod(period)) {
    return db.budgets.filter((b) => b.month === period && keep(b));
  }
  const byCategory = new Map<string, StoredBudget>();
  db.budgets
    .filter((b) => b.month.startsWith(period) && keep(b))
    .forEach((b) => {
      const existing = byCategory.get(b.categoryId);
      byCategory.set(b.categoryId, {
        id: `${period}:${b.categoryId}`,
        categoryId: b.categoryId,
        month: period,
        limitAmount: round2((existing?.limitAmount ?? 0) + b.limitAmount),
      });
    });
  return [...byCategory.values()];
}

function budgetsForPeriod(db: DemoDb, period: Period): Budget[] {
  return storedForPeriod(db, period, (b) => isExpenseBudget(db, b))
    .map((b) => toBudget(db, b))
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
}

function incomePlansForPeriod(db: DemoDb, period: Period): IncomePlan[] {
  const current = currentMonth();
  const ended = isYearPeriod(period)
    ? period < current.slice(0, 4)
    : period < current;
  return storedForPeriod(
    db,
    period,
    (b) => categoryType(db, b.categoryId) === "INCOME",
  )
    .map((b) => {
      const received = sumBy(
        db.transactions.filter(
          (t) =>
            t.type === "INCOME" &&
            t.categoryId === b.categoryId &&
            t.transactionDate.startsWith(period),
        ),
      );
      return {
        id: b.id,
        categoryId: b.categoryId,
        categoryName:
          db.categories.find((c) => c.id === b.categoryId)?.name ??
          "Necunoscut",
        month: period,
        expectedAmount: b.limitAmount,
        receivedAmount: received,
        remainingAmount: Math.max(0, round2(b.limitAmount - received)),
        percentageReceived:
          b.limitAmount > 0 ? round2((received / b.limitAmount) * 100) : 0,
        status:
          received >= b.limitAmount
            ? ("REACHED" as const)
            : ended
              ? ("BELOW" as const)
              : ("PENDING" as const),
      };
    })
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
}

function toGoal(stored: StoredGoal): Goal {
  const completed = stored.currentAmount >= stored.targetAmount;
  return {
    ...stored,
    status: completed ? "COMPLETED" : "ACTIVE",
    progressPercentage:
      stored.targetAmount > 0
        ? Math.min(
            100,
            round2((stored.currentAmount / stored.targetAmount) * 100),
          )
        : 0,
  };
}

function monthTotals(db: DemoDb, month: Period) {
  const inMonth = db.transactions.filter((t) =>
    t.transactionDate.startsWith(month),
  );
  return {
    income: sumBy(inMonth.filter((t) => t.type === "INCOME")),
    expenses: sumBy(inMonth.filter((t) => t.type === "EXPENSE")),
    inMonth,
  };
}

function expensesByCategory(db: DemoDb, month: Period): CategoryExpense[] {
  const expenses = db.transactions.filter(
    (t) => t.type === "EXPENSE" && t.transactionDate.startsWith(month),
  );
  const total = sumBy(expenses);
  const totals = new Map<string, number>();
  expenses.forEach((t) =>
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount),
  );
  return [...totals.entries()]
    .map(([categoryId, amount]) => ({
      categoryId,
      categoryName:
        db.categories.find((c) => c.id === categoryId)?.name ?? "Necunoscut",
      amount: round2(amount),
      percentage: total > 0 ? round2((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function validateTransaction(
  db: DemoDb,
  input: {
    amount: number;
    description: string;
    categoryId: string;
    type: string;
  },
) {
  const category = db.categories.find((c) => c.id === input.categoryId);
  if (!category) throw new ApiError("Categoria selectată nu există.", 400);
  if (category.type !== input.type) {
    throw new ApiError("Categoria nu corespunde tipului tranzacției.", 400);
  }
  if (!(input.amount > 0))
    throw new ApiError("Suma trebuie să fie mai mare decât 0.", 400);
  if (!input.description.trim())
    throw new ApiError("Descrierea este obligatorie.", 400);
}

export const mockDashboardApi: DashboardApi = {
  async get(period) {
    await delay();
    const db = loadDb();
    const { income, expenses, inMonth } = monthTotals(db, period);
    const balance = round2(income - expenses);
    const trendMonths: YearMonth[] = isYearPeriod(period)
      ? Array.from(
          { length: 12 },
          (_, i) => `${period}-${String(i + 1).padStart(2, "0")}`,
        )
      : Array.from({ length: 6 }, (_, i) => shiftMonth(period, i - 5));
    const monthlyTrend = trendMonths.map((m) => {
      const totals = monthTotals(db, m);
      return { month: m, income: totals.income, expenses: totals.expenses };
    });
    const budgets = budgetsForPeriod(db, period);
    const breakdown = expensesByCategory(db, period);
    const budgetedLimit = round2(budgets.reduce((s, b) => s + b.limitAmount, 0));
    const budgetedSpent = round2(budgets.reduce((s, b) => s + b.spentAmount, 0));
    const response: DashboardResponse = {
      month: period,
      totalIncome: income,
      totalExpenses: expenses,
      balance,
      savingsRate: income > 0 ? round2((balance / income) * 100) : 0,
      budgetUsedPercentage:
        budgetedLimit > 0 ? round2((budgetedSpent / budgetedLimit) * 100) : 0,
      topCategories: breakdown.slice(0, 5),
      monthlyTrend,
      expensesByCategory: breakdown,
      budgets,
      goals: db.goals.map(toGoal),
      recentTransactions: [...inMonth]
        .sort(
          (a, b) =>
            b.transactionDate.localeCompare(a.transactionDate) ||
            Number(b.id) - Number(a.id),
        )
        .slice(0, 6)
        .map((t) => toTransaction(db, t)),
    };
    return response;
  },
};

export const mockTransactionsApi: TransactionsApi = {
  async list(query) {
    await delay();
    const db = loadDb();
    const search = query.search ? normalize(query.search.trim()) : "";
    const filtered = db.transactions.filter(
      (t) =>
        (!query.type || t.type === query.type) &&
        (!query.categoryId || t.categoryId === query.categoryId) &&
        (!query.startDate || t.transactionDate >= query.startDate) &&
        (!query.endDate || t.transactionDate <= query.endDate) &&
        (!search || normalize(t.description).includes(search)),
    );
    const direction = query.sortDir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      const primary =
        query.sortBy === "amount"
          ? a.amount - b.amount
          : a.transactionDate.localeCompare(b.transactionDate);
      return primary * direction || Number(b.id) - Number(a.id);
    });
    const start = query.page * query.size;
    const content = filtered
      .slice(start, start + query.size)
      .map((t) => toTransaction(db, t));
    return {
      content,
      page: query.page,
      size: query.size,
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / query.size),
    };
  },

  async create(input) {
    await delay();
    const db = loadDb();
    validateTransaction(db, input);
    const stored: StoredTransaction = {
      id: String(db.nextId.transaction++),
      ...input,
      description: input.description.trim(),
    };
    db.transactions.push(stored);
    saveDb(db);
    learnMemory(db, [{ ...stored, corrected: false }]);
    return toTransaction(db, stored);
  },

  async createMany(inputs) {
    await delay();
    const db = loadDb();
    inputs.forEach((input) => validateTransaction(db, input));
    inputs.forEach((input) => {
      db.transactions.push({
        id: String(db.nextId.transaction++),
        ...input,
        description: input.description.trim(),
      });
    });
    saveDb(db);
    return { created: inputs.length };
  },

  async findExisting(items) {
    await delay();
    const key = (t: {
      type: string;
      transactionDate: string;
      amount: number;
      description: string;
    }) =>
      [
        t.type,
        t.transactionDate,
        round2(t.amount).toFixed(2),
        normalize(t.description).replace(/[^a-z0-9]+/g, " ").trim(),
      ].join("|");
    const saved = new Map<string, number>();
    for (const t of loadDb().transactions) {
      saved.set(key(t), (saved.get(key(t)) ?? 0) + 1);
    }
    return items.flatMap((item) => {
      const left = saved.get(key(item)) ?? 0;
      if (left === 0) return [];
      saved.set(key(item), left - 1);
      return [item.index];
    });
  },

  async update(id, input) {
    await delay();
    const db = loadDb();
    const index = db.transactions.findIndex((t) => t.id === id);
    if (index < 0) throw new ApiError("Tranzacția nu a fost găsită.", 404);
    validateTransaction(db, input);
    const recategorized = db.transactions[index]?.categoryId !== input.categoryId;
    const stored: StoredTransaction = {
      id,
      ...input,
      description: input.description.trim(),
    };
    db.transactions[index] = stored;
    saveDb(db);
    if (recategorized) learnMemory(db, [{ ...stored, corrected: true }]);
    return toTransaction(db, stored);
  },

  async remove(id) {
    await delay();
    const db = loadDb();
    if (!db.transactions.some((t) => t.id === id))
      throw new ApiError("Tranzacția nu a fost găsită.", 404);
    db.transactions = db.transactions.filter((t) => t.id !== id);
    saveDb(db);
  },

  // Mock: nu citește imaginea; propune o cheltuială de exemplu ca să poată fi testat fluxul.
  async scan() {
    await delay(3);
    const db = loadDb();
    const category =
      db.categories.find((c) => c.id === CATEGORY.groceries) ??
      db.categories.find((c) => c.type === "EXPENSE");
    return [
      {
        type: "EXPENSE",
        amount: 87.5,
        description: "Bon exemplu (mod demo) - cumpărături",
        transactionDate: todayIso(),
        categoryId: category?.id ?? null,
      },
    ];
  },
};

const MOCK_KEYWORDS: [string, string][] = [
  ["mega image|kaufland|lidl|carrefour|auchan|profi|penny", CATEGORY.groceries],
  ["uber|bolt|petrom|omv|rompetrol|metrou|stb", CATEGORY.transport],
  ["netflix|spotify|hbo|youtube", CATEGORY.subscriptions],
  ["cinema|concert|teatru", CATEGORY.entertainment],
  ["restaurant|pizza|kfc|mcdonald|starbucks|cafea", CATEGORY.restaurants],
  ["farmacie|catena|medic", CATEGORY.health],
  ["salariu", CATEGORY.salary],
];

// Mock: fără model AI; recunoaște doar câteva comercianți uzuali, restul rămân nesigure ca să poată fi testat fluxul.
export const mockTransactionImportAiApi: TransactionImportAiApi = {
  async detectColumns() {
    await delay();
    throw new ApiError(
      "Modul demo nu are un model AI; coloanele se recunosc după antet.",
      503,
    );
  },
  async suggestCategories(items) {
    await delay();
    const db = loadDb();
    return items.map(({ index, description, type }) => {
      const text = normalize(description);
      const match = MOCK_KEYWORDS.find(([words]) =>
        new RegExp(words).test(text),
      );
      const category = db.categories.find((c) => c.id === match?.[1]);
      return {
        index,
        categoryId: category?.type === type ? category.id : null,
      };
    });
  },
};

function categoryUsage(db: DemoDb, id: string) {
  return {
    transactions: db.transactions.filter((t) => t.categoryId === id).length,
    budgets: db.budgets.filter((b) => b.categoryId === id).length,
  };
}

function findCategory(db: DemoDb, id: string) {
  const category = db.categories.find((c) => c.id === id);
  if (!category) throw new ApiError("Categoria nu există.", 404);
  return category;
}

function validateCategory(db: DemoDb, input: CategoryInput, id?: string) {
  const name = input.name.trim();
  if (!name)
    throw new ApiError("Numele este obligatoriu.", 400, {
      name: "Numele este obligatoriu",
    });
  const duplicate = db.categories.some(
    (c) =>
      c.id !== id &&
      c.type === input.type &&
      c.name.toLocaleLowerCase("ro") === name.toLocaleLowerCase("ro"),
  );
  if (duplicate)
    throw new ApiError("Ai deja o categorie cu acest nume și tip.", 409);
  return {
    name,
    type: input.type,
    color: input.color || null,
    icon: input.icon || null,
  };
}

export const mockCategoriesApi: CategoriesApi = {
  async list() {
    await delay(0.5);
    return loadDb().categories;
  },

  async create(input) {
    await delay();
    const db = loadDb();
    const category = {
      id: String(db.nextId.category++),
      ...validateCategory(db, input),
    };
    db.categories.push(category);
    saveDb(db);
    return category;
  },

  async update(id, input) {
    await delay();
    const db = loadDb();
    const category = findCategory(db, id);
    const usage = categoryUsage(db, id);
    if (
      input.type !== category.type &&
      (usage.transactions > 0 || usage.budgets > 0)
    ) {
      throw new ApiError(
        "Tipul categoriei nu poate fi schimbat cât timp are tranzacții sau bugete.",
        409,
      );
    }
    Object.assign(category, validateCategory(db, input, id));
    saveDb(db);
    return category;
  },

  async usage(id) {
    await delay(0.5);
    const db = loadDb();
    findCategory(db, id);
    return categoryUsage(db, id);
  },

  async remove(id, replacementId) {
    await delay();
    const db = loadDb();
    const category = findCategory(db, id);
    const usage = categoryUsage(db, id);
    if ((usage.transactions > 0 || usage.budgets > 0) && !replacementId) {
      throw new ApiError(
        `Categoria este folosită de ${usage.transactions} tranzacții și ${usage.budgets} bugete. Alege categoria în care să fie mutate.`,
        409,
      );
    }
    if (replacementId) {
      if (replacementId === id)
        throw new ApiError(
          "Alege o altă categorie decât cea pe care o ștergi.",
          400,
        );
      const replacement = findCategory(db, replacementId);
      if (replacement.type !== category.type)
        throw new ApiError("Categoria nouă trebuie să fie de același tip.", 422);
      db.transactions.forEach((t) => {
        if (t.categoryId === id) t.categoryId = replacementId;
      });
      db.budgets = db.budgets.filter(
        (b) =>
          b.categoryId !== id ||
          !db.budgets.some(
            (other) =>
              other.categoryId === replacementId && other.month === b.month,
          ),
      );
      db.budgets.forEach((b) => {
        if (b.categoryId === id) b.categoryId = replacementId;
      });
    }
    moveMemoryCategory(id, replacementId);
    db.categories = db.categories.filter((c) => c.id !== id);
    saveDb(db);
  },
};

export const mockCategoryMemoryApi: CategoryMemoryApi = {
  async match(items) {
    await delay(0.5);
    return matchMemory(loadDb(), items);
  },
  async learn(lessons) {
    await delay(0.5);
    learnMemory(loadDb(), lessons);
  },
  async list() {
    await delay(0.5);
    return listMemory(loadDb());
  },
  async forget(type, key) {
    await delay(0.5);
    forgetMemory(type, key);
  },
  async forgetAll() {
    await delay(0.5);
    forgetMemory();
  },
};

export const mockBudgetsApi: BudgetsApi = {
  async list(period) {
    await delay();
    return budgetsForPeriod(loadDb(), period);
  },

  async listIncome(period) {
    await delay();
    return incomePlansForPeriod(loadDb(), period);
  },

  async create(input) {
    await delay();
    const db = loadDb();
    const category = db.categories.find((c) => c.id === input.categoryId);
    if (!category || category.type !== "EXPENSE") {
      throw new ApiError(
        "Bugetele se pot defini doar pentru categorii de cheltuieli.",
        400,
      );
    }
    if (
      db.budgets.some(
        (b) => b.month === input.month && b.categoryId === input.categoryId,
      )
    ) {
      throw new ApiError(
        "Există deja un buget pentru această categorie în luna selectată.",
        409,
      );
    }
    if (!(input.limitAmount > 0))
      throw new ApiError("Limita trebuie să fie mai mare decât 0.", 400);
    const stored: StoredBudget = { id: String(db.nextId.budget++), ...input };
    db.budgets.push(stored);
    saveDb(db);
    return toBudget(db, stored);
  },

  async createForYear(input) {
    await delay();
    const db = loadDb();
    const ids = new Set<string>();
    for (const item of input.items) {
      if (!db.categories.some((c) => c.id === item.categoryId))
        throw new ApiError("Categoria nu a fost găsită.", 404);
      if (ids.has(item.categoryId))
        throw new ApiError("O categorie apare de mai multe ori în listă.", 400);
      if (!(item.limitAmount > 0))
        throw new ApiError("Suma trebuie să fie mai mare decât 0.", 400);
      ids.add(item.categoryId);
    }
    const months = [...new Set(input.months)]
      .filter((m) => m >= 1 && m <= 12)
      .sort((a, b) => a - b);
    if (months.length === 0)
      throw new ApiError("Alege cel puțin o lună.", 400);
    let created = 0;
    let skipped = 0;
    for (const item of input.items) {
      for (const m of months) {
        const month = `${input.year}-${String(m).padStart(2, "0")}`;
        if (
          db.budgets.some(
            (b) => b.month === month && b.categoryId === item.categoryId,
          )
        ) {
          skipped++;
          continue;
        }
        db.budgets.push({
          id: String(db.nextId.budget++),
          categoryId: item.categoryId,
          month,
          limitAmount: round2(item.limitAmount),
        });
        created++;
      }
    }
    saveDb(db);
    return { created, skipped };
  },
};

/** Ca în backend: mediile lunare pe categorie din lunile încheiate ale anului ales și ale anului anterior. */
export const mockBudgetPlanAiApi: BudgetPlanAiApi = {
  async suggest(year) {
    await delay(4);
    const db = loadDb();
    const reference = Math.min(year, Number(currentMonth().slice(0, 4)));
    const lastComplete = shiftMonth(currentMonth(), -1);
    const firstMonth = db.transactions
      .map((t) => t.transactionDate.slice(0, 7))
      .sort()[0];
    const history: { year: number; byCategory: Map<string, number> }[] = [];
    if (firstMonth) {
      for (const y of [reference - 1, reference]) {
        const months = Array.from(
          { length: 12 },
          (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`,
        ).filter((m) => m >= firstMonth && m <= lastComplete);
        if (months.length === 0) continue;
        const totals = new Map<string, number>();
        db.transactions
          .filter((t) => months.includes(t.transactionDate.slice(0, 7)))
          .forEach((t) =>
            totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount),
          );
        totals.forEach((total, id) =>
          totals.set(id, round2(total / months.length)),
        );
        history.push({ year: y, byCategory: totals });
      }
    }
    const averagesOf = (categoryId: string) =>
      history.map((h) => ({
        year: h.year,
        monthlyAverage: h.byCategory.get(categoryId) ?? 0,
      }));
    const withAmounts = (type: "EXPENSE" | "INCOME") =>
      db.categories
        .filter(
          (c) =>
            c.type === type &&
            history.some((h) => (h.byCategory.get(c.id) ?? 0) > 0),
        )
        .sort((a, b) => a.name.localeCompare(b.name));

    const budgets = withAmounts("EXPENSE").map((c) => {
      const averages = averagesOf(c.id);
      const recent = averages[averages.length - 1]?.monthlyAverage ?? 0;
      const previous =
        averages.length > 1 ? (averages[0]?.monthlyAverage ?? 0) : recent;
      const growing = previous > 0 && recent > previous * 1.1;
      const base = (0.6 * recent + 0.4 * previous) * (growing ? 0.95 : 1);
      return {
        categoryId: c.id,
        categoryName: c.name,
        monthlyAmount: Math.max(10, Math.ceil(base / 10) * 10),
        reason: growing
          ? `Cheltuielile au crescut de la ${formatCurrency(previous)} la ${formatCurrency(recent)} pe lună; propun o reducere ușoară.`
          : `Media lunară recentă este ${formatCurrency(recent)}; limita o urmează îndeaproape.`,
        history: averages,
      };
    });
    // Prudent: nu mai mult decât cea mai mică medie, rotunjit în jos.
    const incomes = withAmounts("INCOME").map((c) => {
      const averages = averagesOf(c.id);
      const lowest = Math.min(
        ...averages.map((a) => a.monthlyAverage).filter((v) => v > 0),
      );
      return {
        categoryId: c.id,
        categoryName: c.name,
        monthlyAmount: Math.max(10, Math.floor(lowest / 10) * 10),
        reason: `Estimare prudentă: media lunară cea mai mică din ultimii ani este ${formatCurrency(lowest)}.`,
        history: averages,
      };
    });
    if (budgets.length === 0 && incomes.length === 0) {
      throw new ApiError(
        `Nu există tranzacții în ${reference - 1} sau ${reference} (luni încheiate) pe baza cărora să fie propus un buget.`,
        422,
      );
    }
    const total = budgets.reduce((sum, b) => sum + b.monthlyAmount, 0);
    const income = incomes.reduce((sum, b) => sum + b.monthlyAmount, 0);
    return {
      year,
      basedOnYears: history.map((h) => h.year),
      summary: `Propunere pe baza mediilor lunare din ${history.map((h) => h.year).join(" și ")}: venituri așteptate de ${formatCurrency(income)} și limite de ${formatCurrency(total)} pe lună, deci un sold planificat de ${formatCurrency(income - total)} pe lună.`,
      budgets,
      incomes,
      generatedAt: new Date().toISOString(),
    };
  },
};

export const mockGoalsApi: GoalsApi = {
  async list() {
    await delay();
    return loadDb().goals.map(toGoal);
  },

  async create(input) {
    await delay();
    const db = loadDb();
    if (!(input.targetAmount > 0))
      throw new ApiError("Suma țintă trebuie să fie mai mare decât 0.", 400);
    const stored: StoredGoal = {
      id: String(db.nextId.goal++),
      name: input.name.trim(),
      targetAmount: input.targetAmount,
      currentAmount: 0,
      targetDate: input.targetDate ?? null,
    };
    db.goals.push(stored);
    saveDb(db);
    return toGoal(stored);
  },

  async contribute(id, input) {
    await delay();
    const db = loadDb();
    const goal = db.goals.find((g) => g.id === id);
    if (!goal) throw new ApiError("Obiectivul nu a fost găsit.", 404);
    if (toGoal(goal).status === "COMPLETED")
      throw new ApiError(
        "Obiectivul este deja finalizat și nu mai acceptă contribuții.",
        409,
      );
    if (!(input.amount > 0))
      throw new ApiError("Contribuția trebuie să fie mai mare decât 0.", 400);
    goal.currentAmount = round2(goal.currentAmount + input.amount);
    saveDb(db);
    return toGoal(goal);
  },
};

const roundTo10 = (value: number) => Math.max(10, Math.round(value / 10) * 10);

export const mockAiInsightsApi: AiInsightsApi = {
  async analyze(request) {
    await delay(5);
    const db = loadDb();
    const period: Period =
      request.year !== undefined
        ? String(request.year)
        : (request.month ?? todayIso().slice(0, 7));
    const month = period;
    const { income, expenses } = monthTotals(db, month);
    if (income === 0 && expenses === 0) {
      throw new ApiError(
        "Nu există suficiente tranzacții în perioada selectată pentru a genera o analiză.",
        422,
      );
    }
    const balance = income - expenses;
    const savingsRate = income > 0 ? (balance / income) * 100 : 0;
    const byCategory = expensesByCategory(db, month);
    const budgets = budgetsForPeriod(db, month);
    const recommendations: AiRecommendation[] = [];

    const top = byCategory[0];
    if (top) {
      recommendations.push({
        id: `top-${top.categoryId}`,
        title: `Redu cheltuielile pentru ${top.categoryName}`,
        explanation: `${top.categoryName} reprezintă ${formatPercent(top.percentage)} din cheltuielile lunii (${formatCurrency(top.amount)}). O reducere moderată a acestei categorii ar avea cel mai mare impact asupra bugetului.`,
        priority: top.percentage > 35 ? "HIGH" : "MEDIUM",
        estimatedMonthlySavings: roundTo10(top.amount * 0.1),
        categoryId: top.categoryId,
      });
    }

    budgets
      .filter((b) => b.percentageUsed >= 80)
      .sort((a, b) => b.percentageUsed - a.percentageUsed)
      .slice(0, 2)
      .forEach((b) => {
        const exceeded = b.percentageUsed > 100;
        recommendations.push({
          id: `budget-${b.id}`,
          title: exceeded
            ? `Ai depășit bugetul pentru ${b.categoryName}`
            : `Bugetul pentru ${b.categoryName} este aproape epuizat`,
          explanation: exceeded
            ? `Ai cheltuit ${formatCurrency(b.spentAmount)} din ${formatCurrency(b.limitAmount)}. Stabilește o limită săptămânală pentru restul lunii și amână achizițiile care nu sunt urgente.`
            : `Ai folosit ${formatPercent(b.percentageUsed)} din buget și mai ai ${formatCurrency(b.remainingAmount)}. Monitorizează atent această categorie până la finalul lunii.`,
          priority: exceeded ? "HIGH" : "MEDIUM",
          estimatedMonthlySavings: roundTo10(
            exceeded ? Math.abs(b.remainingAmount) : b.spentAmount * 0.08,
          ),
          categoryId: b.categoryId,
        });
      });

    const subscriptions = byCategory.find(
      (c) => c.categoryId === CATEGORY.subscriptions,
    );
    if (subscriptions) {
      recommendations.push({
        id: "subscriptions",
        title: "Revizuiește abonamentele active",
        explanation: `Plătești ${formatCurrency(subscriptions.amount)} pe lună pentru abonamente. Verifică dacă le folosești pe toate și renunță la cele redundante.`,
        priority: "LOW",
        estimatedMonthlySavings: roundTo10(subscriptions.amount * 0.2),
        categoryId: CATEGORY.subscriptions,
      });
    }

    recommendations.push({
      id: "auto-savings",
      title:
        savingsRate < 20
          ? "Automatizează economisirea"
          : "Menține ritmul de economisire",
      explanation:
        savingsRate < 20
          ? "Rata ta de economisire este sub 20%. Un transfer automat în ziua salariului te ajută să economisești înainte de a cheltui."
          : "Rata ta de economisire este solidă. Poți direcționa surplusul către un obiectiv concret, de exemplu fondul de urgență.",
      priority: savingsRate < 10 ? "HIGH" : "MEDIUM",
      estimatedMonthlySavings: roundTo10(income * 0.05),
      categoryId: null,
    });

    const summary =
      `În ${formatPeriodLabel(month).toLowerCase()} ai încasat ${formatCurrency(income)} și ai cheltuit ${formatCurrency(expenses)}, ` +
      `ceea ce înseamnă un sold de ${formatCurrency(balance)} și o rată de economisire de ${formatPercent(savingsRate, 1)}. ` +
      (top
        ? `Cea mai mare categorie de cheltuieli este ${top.categoryName}.`
        : "");

    return {
      summary,
      recommendations: recommendations.slice(0, 5),
      generatedAt: new Date().toISOString(),
    };
  },
};
