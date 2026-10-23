import type {
  CategoryMemoryLesson,
  ImportCategoryItem,
  ImportCategorySuggestion,
  RememberedMerchant,
  TransactionType,
} from "../types";
import type { DemoDb } from "./seed";

// Aceleași reguli ca CategoryMemoryService și MerchantKey din backend, pentru modul demo.

const STORAGE_KEY = "smartbudget.demo.categoryMemory";
const MAX_TOKENS = 4;
const MIN_GROUP_TOKEN = 3;
const DOMINANT_SHARE = 0.8;

const NOISE = new Set(
  (
    "s c r l a sc srl sa sca snc pfa ii if impex comimpex ltd llc inc gmbh sarl spa bv nv plc kft " +
    "www http https com ro net eu org " +
    "pos epos plata cumparare tranzactie comerciant card nr ref tid mid rrn terminal autorizare valoare data op " +
    "ordin incasare contactless online visa mastercard maestro ron eur usd " +
    "la in de din si pe cu the of and"
  ).split(" "),
);

interface Vote {
  type: TransactionType;
  key: string;
  categoryId: string;
  hits: number;
  updatedAt: string;
}

export function merchantKey(description: string): string {
  return description
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !/\d/.test(word) && !NOISE.has(word))
    .slice(0, MAX_TOKENS)
    .join(" ");
}

const firstToken = (key: string) => key.split(" ")[0] ?? "";

function load(): Vote[] {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    return Array.isArray(parsed) ? (parsed as Vote[]) : [];
  } catch {
    return [];
  }
}

function save(votes: Vote[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(votes));
  } catch {
    // Fără persistență, memoria demo se pierde; aplicația merge mai departe.
  }
}

function dominant(
  votes: Vote[],
  db: DemoDb,
  type: TransactionType,
): string | null {
  const totals = new Map<string, number>();
  for (const vote of votes) {
    const category = db.categories.find((c) => c.id === vote.categoryId);
    if (category?.type !== type) continue;
    totals.set(vote.categoryId, (totals.get(vote.categoryId) ?? 0) + vote.hits);
  }
  let best: string | null = null;
  let bestHits = 0;
  let total = 0;
  totals.forEach((hits, categoryId) => {
    total += hits;
    if (hits > bestHits) {
      best = categoryId;
      bestHits = hits;
    }
  });
  return best !== null && bestHits >= DOMINANT_SHARE * total ? best : null;
}

export function matchMemory(
  db: DemoDb,
  items: ImportCategoryItem[],
): ImportCategorySuggestion[] {
  const votes = load();
  return items.map(({ index, description, type }) => {
    const key = merchantKey(description);
    if (!key) return { index, categoryId: null };
    const sameType = votes.filter((v) => v.type === type);
    const token = firstToken(key);
    const categoryId =
      dominant(
        sameType.filter((v) => v.key === key),
        db,
        type,
      ) ??
      (token.length >= MIN_GROUP_TOKEN
        ? dominant(
            sameType.filter((v) => firstToken(v.key) === token),
            db,
            type,
          )
        : null);
    return { index, categoryId };
  });
}

export function learnMemory(db: DemoDb, lessons: CategoryMemoryLesson[]) {
  let votes = load();
  const now = new Date().toISOString();
  for (const lesson of lessons) {
    const key = merchantKey(lesson.description);
    const category = db.categories.find((c) => c.id === lesson.categoryId);
    if (!key || category?.type !== lesson.type) continue;
    const sameKey = (v: Vote) => v.type === lesson.type && v.key === key;
    if (lesson.corrected) {
      votes = votes.filter(
        (v) => !sameKey(v) || v.categoryId === lesson.categoryId,
      );
    }
    const existing = votes.find(
      (v) => sameKey(v) && v.categoryId === lesson.categoryId,
    );
    if (existing) {
      existing.hits++;
      existing.updatedAt = now;
    } else {
      votes.push({
        type: lesson.type,
        key,
        categoryId: lesson.categoryId,
        hits: 1,
        updatedAt: now,
      });
    }
  }
  save(votes);
}

export function listMemory(db: DemoDb): RememberedMerchant[] {
  const groups = new Map<string, Vote[]>();
  for (const vote of load()) {
    const category = db.categories.find((c) => c.id === vote.categoryId);
    if (category?.type !== vote.type) continue;
    const id = `${vote.type}|${vote.key}`;
    groups.set(id, [...(groups.get(id) ?? []), vote]);
  }
  return [...groups.values()]
    .map((group) => {
      const best = group.reduce((a, b) => (b.hits > a.hits ? b : a));
      const hits = group.reduce((sum, v) => sum + v.hits, 0);
      const updatedAt = group.reduce(
        (latest, v) => (v.updatedAt > latest ? v.updatedAt : latest),
        "",
      );
      return {
        type: best.type,
        key: best.key,
        categoryId: best.categoryId,
        hits,
        certain: best.hits >= DOMINANT_SHARE * hits,
        updatedAt,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function forgetMemory(type?: TransactionType, key?: string) {
  save(
    type === undefined
      ? []
      : load().filter((v) => v.type !== type || v.key !== key),
  );
}

/** La ștergerea unei categorii, alegerile ei trec la `toId` sau se uită. */
export function moveMemoryCategory(fromId: string, toId?: string) {
  const votes = load();
  const kept = votes.filter((v) => v.categoryId !== fromId);
  if (toId) {
    for (const vote of votes.filter((v) => v.categoryId === fromId)) {
      const target = kept.find(
        (v) =>
          v.type === vote.type && v.key === vote.key && v.categoryId === toId,
      );
      if (target) target.hits += vote.hits;
      else kept.push({ ...vote, categoryId: toId });
    }
  }
  save(kept);
}
