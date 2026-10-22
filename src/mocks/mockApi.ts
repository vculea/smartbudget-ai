import type {
  AiInsightsApi,
  BudgetsApi,
  CategoriesApi,
  DashboardApi,
  GoalsApi,
  TransactionsApi,
} from "../api/contracts";
import { ApiError } from "../api/errors";
import { env } from "../config/env";
import type {
  AiRecommendation,
  Budget,
  CategoryExpense,
  DashboardResponse,
  Goal,
  Transaction,
  YearMonth,
} from "../types";
import { formatCurrency, formatPercent } from "../utils/format";
import { formatMonthLabel, shiftMonth, todayIso } from "../utils/date";
import {
  CATEGORY,
  type DemoDb,
  type StoredBudget,
  type StoredGoal,
  type StoredTransaction,
} from "./seed";
import { loadDb, saveDb } from "./db";

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

function monthTotals(db: DemoDb, month: YearMonth) {
  const inMonth = db.transactions.filter((t) =>
    t.transactionDate.startsWith(month),
  );
  return {
    income: sumBy(inMonth.filter((t) => t.type === "INCOME")),
    expenses: sumBy(inMonth.filter((t) => t.type === "EXPENSE")),
    inMonth,
  };
}

function expensesByCategory(db: DemoDb, month: YearMonth): CategoryExpense[] {
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
  async get(month) {
    await delay();
    const db = loadDb();
    const { income, expenses, inMonth } = monthTotals(db, month);
    const balance = round2(income - expenses);
    const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
      const m = shiftMonth(month, i - 5);
      const totals = monthTotals(db, m);
      return { month: m, income: totals.income, expenses: totals.expenses };
    });
    const budgets = db.budgets
      .filter((b) => b.month === month)
      .map((b) => toBudget(db, b));
    const breakdown = expensesByCategory(db, month);
    const budgetedLimit = round2(budgets.reduce((s, b) => s + b.limitAmount, 0));
    const budgetedSpent = round2(budgets.reduce((s, b) => s + b.spentAmount, 0));
    const response: DashboardResponse = {
      month,
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
    return toTransaction(db, stored);
  },

  async update(id, input) {
    await delay();
    const db = loadDb();
    const index = db.transactions.findIndex((t) => t.id === id);
    if (index < 0) throw new ApiError("Tranzacția nu a fost găsită.", 404);
    validateTransaction(db, input);
    const stored: StoredTransaction = {
      id,
      ...input,
      description: input.description.trim(),
    };
    db.transactions[index] = stored;
    saveDb(db);
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
};

export const mockCategoriesApi: CategoriesApi = {
  async list() {
    await delay(0.5);
    return loadDb().categories;
  },
};

export const mockBudgetsApi: BudgetsApi = {
  async list(month) {
    await delay();
    const db = loadDb();
    return db.budgets
      .filter((b) => b.month === month)
      .map((b) => toBudget(db, b));
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
    const month = request.month ?? todayIso().slice(0, 7);
    const { income, expenses } = monthTotals(db, month);
    if (income === 0 && expenses === 0) {
      throw new ApiError(
        "Nu există suficiente tranzacții în luna selectată pentru a genera o analiză.",
        422,
      );
    }
    const balance = income - expenses;
    const savingsRate = income > 0 ? (balance / income) * 100 : 0;
    const byCategory = expensesByCategory(db, month);
    const budgets = db.budgets
      .filter((b) => b.month === month)
      .map((b) => toBudget(db, b));
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
      `În ${formatMonthLabel(month).toLowerCase()} ai încasat ${formatCurrency(income)} și ai cheltuit ${formatCurrency(expenses)}, ` +
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
