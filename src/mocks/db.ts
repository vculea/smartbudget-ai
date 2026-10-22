import { DB_VERSION, createSeed, type DemoDb } from "./seed";

const STORAGE_KEY = "smartbudget.demo.db";

function isValid(value: unknown): value is DemoDb {
  const db = value as DemoDb | null;
  return (
    !!db &&
    db.version === DB_VERSION &&
    Array.isArray(db.transactions) &&
    Array.isArray(db.budgets) &&
    Array.isArray(db.goals) &&
    Array.isArray(db.categories)
  );
}

export function loadDb(): DemoDb {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValid(parsed)) return parsed;
    }
  } catch {
    // Date corupte sau stocare indisponibilă: se regenerează seed-ul.
  }
  const seed = createSeed();
  saveDb(seed);
  return seed;
}

export function saveDb(db: DemoDb): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Ignorat: aplicația demo rămâne utilizabilă și fără persistență.
  }
}

export function resetDemoData(): void {
  saveDb(createSeed());
}
