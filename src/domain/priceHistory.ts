import { dayOf } from "./day";
import { fold } from "./scan/fold";

/**
 * Prices the app has itself seen, one point per change. No third-party history service is used, so
 * "lowest" always means "lowest this app has observed", and the UI says so.
 */
export type PricePoint = [day: number, cents: number];
export interface PriceEntry {
  title: string;
  points: PricePoint[];
}
export type PriceHistory = Record<string, PriceEntry>;

export interface PriceObservation {
  store: string;
  title: string;
  currency: string;
  cents: number;
}

export const MAX_POINTS = 60;
export const MAX_ENTRIES = 1500;
const MAX_CENTS = 10_000_000;
const KEY = /^(steam|gog|epic)\|[^|]{1,200}\|[A-Z]{3}$/;

export { dayOf };
export const historyKey = (store: string, title: string, currency: string): string => `${store}|${fold(title)}|${currency}`;
const lastDay = (e: PriceEntry) => e.points[e.points.length - 1]![0];
const hasKey = (h: PriceHistory, k: string) => Object.prototype.hasOwnProperty.call(h, k);

/** Adds what was just seen. Unchanged prices add nothing; every change is a point, so the last one is always the price now. Returns `h` itself when nothing changed. */
export function recordPrices(h: PriceHistory, seen: PriceObservation[], now = Date.now()): PriceHistory {
  const day = dayOf(now);
  let next = h;
  const touch = () => { if (next === h) next = { ...h }; };
  for (const o of seen) {
    if (!Number.isInteger(o.cents) || o.cents < 0 || o.cents > MAX_CENTS || !/^[A-Z]{3}$/.test(o.currency)) continue;
    const key = historyKey(o.store, o.title, o.currency);
    if (!KEY.test(key)) continue;
    const entry = hasKey(next, key) ? next[key]! : undefined;
    const last = entry?.points[entry.points.length - 1];
    if (last && last[1] === o.cents) continue;
    touch();
    if (!entry) { next[key] = { title: o.title.slice(0, 120), points: [[day, o.cents]] }; continue; }
    next[key] = { title: entry.title, points: [...entry.points, [day, o.cents] as PricePoint].slice(-MAX_POINTS) };
  }
  if (next === h) return h;
  const keys = Object.keys(next);
  if (keys.length <= MAX_ENTRIES) return next;
  // Forget the entries not seen for the longest time.
  const keep = new Set(keys.sort((a, b) => lastDay(next[b]!) - lastDay(next[a]!)).slice(0, MAX_ENTRIES));
  return Object.fromEntries(Object.entries(next).filter(([k]) => keep.has(k)));
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Storage and backups are untrusted: only well-formed, ordered, bounded series survive. */
export function sanitizeHistory(raw: unknown): PriceHistory {
  if (!isObj(raw)) return {};
  const out: PriceHistory = {};
  for (const [key, v] of Object.entries(raw)) {
    if (Object.keys(out).length >= MAX_ENTRIES) break;
    if (!KEY.test(key) || !isObj(v) || typeof v["title"] !== "string" || !v["title"] || !Array.isArray(v["points"])) continue;
    const points: PricePoint[] = [];
    for (const p of v["points"]) {
      if (!Array.isArray(p) || p.length !== 2) continue;
      const [d, c] = p as [unknown, unknown];
      if (typeof d !== "number" || typeof c !== "number" || !Number.isInteger(d) || !Number.isInteger(c) || d < 0 || d > 3_000_000 || c < 0 || c > MAX_CENTS) continue;
      if (points.length && d < points[points.length - 1]![0]) continue;
      points.push([d, c]);
    }
    if (points.length) out[key] = { title: v["title"].slice(0, 120), points: points.slice(-MAX_POINTS) };
  }
  return out;
}

export interface LowestSeen {
  cents: number;
  day: number;
}

export function lowestSeen(e: PriceEntry | undefined): LowestSeen | undefined {
  if (!e) return undefined;
  let best: LowestSeen | undefined;
  for (const [day, cents] of e.points) if (!best || cents < best.cents) best = { cents, day };
  return best;
}

/** True when the current price is the lowest seen *and* the price has been seen higher before (a single point proves nothing). */
export function isLowestSeen(e: PriceEntry | undefined): boolean {
  if (!e || e.points.length < 2) return false;
  const cur = e.points[e.points.length - 1]![1];
  return e.points.every(([, c]) => c >= cur) && e.points.some(([, c]) => c > cur);
}

export interface PriceChange {
  key: string;
  title: string;
  from: number;
  to: number;
  day: number;
  currency: string;
  store: string;
}

/** Price drops recorded after `sinceDay`, biggest relative drop first. */
export function priceDrops(h: PriceHistory, sinceDay: number): PriceChange[] {
  const out: PriceChange[] = [];
  for (const [key, e] of Object.entries(h)) {
    if (e.points.length < 2) continue;
    const [day, to] = e.points[e.points.length - 1]!;
    const from = e.points[e.points.length - 2]![1];
    if (day <= sinceDay || to >= from) continue;
    const [store, , currency] = key.split("|") as [string, string, string];
    out.push({ key, title: e.title, from, to, day, currency, store });
  }
  const cut = (c: PriceChange) => (c.from - c.to) / c.from;
  return out.sort((a, b) => cut(b) - cut(a) || a.title.localeCompare(b.title));
}
