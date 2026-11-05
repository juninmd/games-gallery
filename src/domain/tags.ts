import { fold } from "./scan/fold";
import type { Game } from "./types";

export const MAX_TAGS = 12;
export const MAX_TAG_LEN = 30;

/** Single-line, bounded, no control characters; "" when nothing usable is left. */
export const cleanTag = (s: string): string =>
  s.replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LEN).trim();

export const tagKey = (tag: string): string => fold(tag);

/** Untrusted input -> distinct (by folded key), bounded tags; undefined when none survive. */
export function sanitizeTags(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const tag = cleanTag(item);
    const key = tagKey(tag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out.length ? out : undefined;
}

/** Adds a tag unless it is empty, a duplicate, or over the limit; returns the same array then. */
export function addTag(tags: string[] | undefined, input: string): string[] | undefined {
  return sanitizeTags([...(tags ?? []), input]);
}

export function removeTag(tags: string[] | undefined, tag: string): string[] | undefined {
  const rest = (tags ?? []).filter((t) => tagKey(t) !== tagKey(tag));
  return rest.length ? rest : undefined;
}

/** Every tag in use with how many titles carry it, most used first (a title counts once per tag). */
export function tagCounts(games: Game[]): { key: string; label: string; count: number }[] {
  const map = new Map<string, { key: string; label: string; count: number }>();
  for (const g of games) {
    for (const t of g.tags ?? []) {
      const key = tagKey(t);
      if (!key) continue;
      const hit = map.get(key);
      if (hit) hit.count++;
      else map.set(key, { key, label: t, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}
