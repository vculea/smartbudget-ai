import type {
  Category,
  Goal,
  IsoDate,
  TransactionType,
  YearMonth,
} from "../types";
import {
  addMonthsToDate,
  currentMonth,
  monthEnd,
  shiftMonth,
  todayIso,
} from "../utils/date";

export interface StoredTransaction {
  id: number;
  type: TransactionType;
  amount: number;
  description: string;
  transactionDate: IsoDate;
  categoryId: number;
}

export interface StoredBudget {
  id: number;
  categoryId: number;
  month: YearMonth;
  limitAmount: number;
}

export type StoredGoal = Omit<Goal, "status" | "progressPercentage">;

export interface DemoDb {
  version: number;
  nextId: { transaction: number; budget: number; goal: number };
  categories: Category[];
  transactions: StoredTransaction[];
  budgets: StoredBudget[];
  goals: StoredGoal[];
}

export const DB_VERSION = 1;

export const CATEGORY = {
  groceries: 1,
  housing: 2,
  transport: 3,
  entertainment: 4,
  health: 5,
  shopping: 6,
  restaurants: 7,
  subscriptions: 8,
  education: 9,
  salary: 10,
  freelance: 11,
  investments: 12,
} as const;

const categories: Category[] = [
  {
    id: CATEGORY.groceries,
    name: "Alimente",
    type: "EXPENSE",
    color: "#10b981",
  },
  {
    id: CATEGORY.housing,
    name: "Chirie și utilități",
    type: "EXPENSE",
    color: "#4f46e5",
  },
  {
    id: CATEGORY.transport,
    name: "Transport",
    type: "EXPENSE",
    color: "#0ea5e9",
  },
  {
    id: CATEGORY.entertainment,
    name: "Divertisment",
    type: "EXPENSE",
    color: "#ec4899",
  },
  { id: CATEGORY.health, name: "Sănătate", type: "EXPENSE", color: "#14b8a6" },
  {
    id: CATEGORY.shopping,
    name: "Shopping",
    type: "EXPENSE",
    color: "#f59e0b",
  },
  {
    id: CATEGORY.restaurants,
    name: "Restaurante",
    type: "EXPENSE",
    color: "#f97316",
  },
  {
    id: CATEGORY.subscriptions,
    name: "Abonamente",
    type: "EXPENSE",
    color: "#7c3aed",
  },
  {
    id: CATEGORY.education,
    name: "Educație",
    type: "EXPENSE",
    color: "#64748b",
  },
  { id: CATEGORY.salary, name: "Salariu", type: "INCOME", color: "#059669" },
  {
    id: CATEGORY.freelance,
    name: "Freelance",
    type: "INCOME",
    color: "#22c55e",
  },
  {
    id: CATEGORY.investments,
    name: "Investiții",
    type: "INCOME",
    color: "#84cc16",
  },
];

const BUDGET_LIMITS: Array<[number, number]> = [
  [CATEGORY.groceries, 1500],
  [CATEGORY.restaurants, 500],
  [CATEGORY.transport, 450],
  [CATEGORY.entertainment, 350],
  [CATEGORY.shopping, 600],
  [CATEGORY.subscriptions, 250],
  [CATEGORY.health, 300],
];

/** PRNG determinist, astfel încât datele demo să fie stabile între rulări. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GROCERY_STORES = [
  "Kaufland",
  "Mega Image",
  "Lidl",
  "Carrefour",
  "Piața Obor",
  "Profi",
];
const TRANSPORT_ITEMS = [
  "Benzină",
  "Abonament metrou",
  "Bolt",
  "Uber",
  "Parcare",
  "Spălătorie auto",
];
const RESTAURANTS = [
  "Pizzeria Napoli",
  "Sushi Master",
  "Cafenea Origo",
  "Burger House",
  "Trattoria Roma",
];
const FUN_ITEMS = [
  "Bilete cinema",
  "Concert",
  "Bowling cu prietenii",
  "Escape room",
  "Teatru",
];
const HEALTH_ITEMS = [
  "Farmacie",
  "Consultație stomatologică",
  "Analize medicale",
];
const SHOPPING_ITEMS = [
  "Haine H&M",
  "Pantofi sport",
  "Cadou aniversare",
  "Accesorii casă",
  "Electronice",
];

export function createSeed(): DemoDb {
  const rand = mulberry32(20260101);
  const between = (min: number, max: number) =>
    Math.round(min + rand() * (max - min));
  const pick = <T>(items: T[]): T =>
    items[Math.floor(rand() * items.length)] as T;

  const today = todayIso();
  const thisMonth = currentMonth();
  const transactions: StoredTransaction[] = [];
  let nextTxId = 1;

  const add = (
    month: YearMonth,
    day: number,
    type: TransactionType,
    categoryId: number,
    description: string,
    amount: number,
  ) => {
    const lastDay = Number(monthEnd(month).slice(8, 10));
    const date = `${month}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
    if (date > today) return;
    transactions.push({
      id: nextTxId++,
      type,
      amount,
      description,
      transactionDate: date,
      categoryId,
    });
  };

  for (let offset = -5; offset <= 0; offset++) {
    const month = shiftMonth(thisMonth, offset);
    const progress = offset + 5;

    add(
      month,
      5,
      "INCOME",
      CATEGORY.salary,
      "Salariu lunar",
      8200 + (progress >= 3 ? 400 : 0),
    );
    if (rand() > 0.35) {
      add(
        month,
        between(14, 22),
        "INCOME",
        CATEGORY.freelance,
        "Proiect web freelance",
        between(800, 2200),
      );
    }
    add(
      month,
      25,
      "INCOME",
      CATEGORY.investments,
      "Dividende",
      between(120, 320),
    );

    add(month, 3, "EXPENSE", CATEGORY.housing, "Chirie apartament", 2300);
    add(
      month,
      9,
      "EXPENSE",
      CATEGORY.housing,
      "Facturi utilități",
      between(260, 430),
    );

    const groceryCount = between(8, 10);
    for (let i = 0; i < groceryCount; i++) {
      add(
        month,
        between(1, 28),
        "EXPENSE",
        CATEGORY.groceries,
        pick(GROCERY_STORES),
        between(55, 190),
      );
    }
    for (let i = 0; i < between(3, 5); i++) {
      add(
        month,
        between(1, 28),
        "EXPENSE",
        CATEGORY.transport,
        pick(TRANSPORT_ITEMS),
        between(25, 140),
      );
    }
    for (let i = 0; i < between(3, 5); i++) {
      add(
        month,
        between(1, 28),
        "EXPENSE",
        CATEGORY.restaurants,
        pick(RESTAURANTS),
        between(70, 170),
      );
    }
    for (let i = 0; i < between(2, 3); i++) {
      add(
        month,
        between(1, 28),
        "EXPENSE",
        CATEGORY.entertainment,
        pick(FUN_ITEMS),
        between(60, 190),
      );
    }
    for (let i = 0; i < between(1, 2); i++) {
      add(
        month,
        between(1, 28),
        "EXPENSE",
        CATEGORY.health,
        pick(HEALTH_ITEMS),
        between(40, 220),
      );
    }
    for (let i = 0; i < between(1, 3); i++) {
      add(
        month,
        between(1, 28),
        "EXPENSE",
        CATEGORY.shopping,
        pick(SHOPPING_ITEMS),
        between(90, 380),
      );
    }
    add(month, 12, "EXPENSE", CATEGORY.subscriptions, "Netflix", 40);
    add(month, 12, "EXPENSE", CATEGORY.subscriptions, "Spotify", 25);
    add(
      month,
      14,
      "EXPENSE",
      CATEGORY.subscriptions,
      "Abonament sală de sport",
      150,
    );
    if (rand() > 0.6) {
      add(
        month,
        between(10, 20),
        "EXPENSE",
        CATEGORY.education,
        "Curs online",
        between(150, 400),
      );
    }
  }

  // Cheltuieli suplimentare în luna curentă, ca bugetele să arate stări diferite.
  add(thisMonth, 1, "EXPENSE", CATEGORY.restaurants, "Cină aniversară", 240);
  add(thisMonth, 1, "EXPENSE", CATEGORY.restaurants, "Brunch de weekend", 130);

  const budgets: StoredBudget[] = [];
  let nextBudgetId = 1;
  for (let offset = -5; offset <= 0; offset++) {
    const month = shiftMonth(thisMonth, offset);
    for (const [categoryId, limitAmount] of BUDGET_LIMITS) {
      budgets.push({ id: nextBudgetId++, categoryId, month, limitAmount });
    }
  }

  const goals: StoredGoal[] = [
    {
      id: 1,
      name: "Fond de urgență",
      targetAmount: 15000,
      currentAmount: 9200,
      targetDate: addMonthsToDate(today, 8),
    },
    {
      id: 2,
      name: "Vacanță în Grecia",
      targetAmount: 6000,
      currentAmount: 3850,
      targetDate: addMonthsToDate(today, 5),
    },
    {
      id: 3,
      name: "Laptop nou",
      targetAmount: 7500,
      currentAmount: 7500,
      targetDate: addMonthsToDate(today, -1),
    },
    {
      id: 4,
      name: "Avans apartament",
      targetAmount: 50000,
      currentAmount: 12400,
      targetDate: addMonthsToDate(today, 30),
    },
    {
      id: 5,
      name: "Curs de certificare",
      targetAmount: 2500,
      currentAmount: 600,
      targetDate: addMonthsToDate(today, -1),
    },
  ];

  return {
    version: DB_VERSION,
    nextId: {
      transaction: nextTxId,
      budget: nextBudgetId,
      goal: goals.length + 1,
    },
    categories,
    transactions,
    budgets,
    goals,
  };
}
