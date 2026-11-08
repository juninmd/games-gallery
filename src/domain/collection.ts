import type { Game } from "./types";

export const MAX_TAGS = 20;
export const MAX_TAG_LEN = 40;
export const MAX_LOAN_NAME = 80;

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Trims, collapses spaces, drops empties and case/accent duplicates, keeps the first spelling. */
export function normalizeTags(raw: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const t = v.replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LEN);
    const key = fold(t);
    if (!t || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export const sameTag = (a: string, b: string) => fold(a) === fold(b);

export const hasTag = (g: Game, tag: string) => (g.tags ?? []).some((t) => sameTag(t, tag));

/** Every tag in the library with how many games carry it, most used first. */
export function tagCounts(games: readonly Game[]): [string, number][] {
  const m = new Map<string, [string, number]>();
  for (const g of games) for (const t of g.tags ?? []) {
    const k = fold(t);
    const cur = m.get(k);
    m.set(k, cur ? [cur[0], cur[1] + 1] : [t, 1]);
  }
  return [...m.values()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
}

/** Patch that adds a tag; undefined when it is empty, a duplicate or over the limit. */
export function addTag(g: Game, tag: string): Partial<Game> | undefined {
  const cur = g.tags ?? [];
  const next = normalizeTags([...cur, tag]);
  return next.length > cur.length ? { tags: next } : undefined;
}

export function removeTag(g: Game, tag: string): Partial<Game> {
  const next = (g.tags ?? []).filter((t) => !sameTag(t, tag));
  return { tags: next.length ? next : undefined };
}

/** Whole days a copy has been away; 0 for today or a bad date. */
export function loanDays(since: string, now = new Date()): number {
  const t = Date.parse(since);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now.getTime() - t) / 86_400_000)) : 0;
}

/** Only discs and cartridges can be lent; digital store copies cannot. */
export const canLend = (g: Pick<Game, "providerId" | "owned">) => g.owned && g.providerId === "physical";

export const loanedGames = (games: readonly Game[]) => games.filter((g) => g.loan);
