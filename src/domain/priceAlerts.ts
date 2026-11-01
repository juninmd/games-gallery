import { fold } from "./scan/fold";

/** A price you would pay for a title, whichever store sells it. */
export interface PriceTarget {
  cents: number;
  currency: string;
  title: string;
}
export type PriceTargets = Record<string, PriceTarget>;

export interface AlertHit {
  title: string;
  store: string;
  finalCents: number;
  targetCents: number;
  currency: string;
}

const MAX_CENTS = 10_000_000; // R$ 100 000: anything above is a typo

export const targetKey = (title: string) => fold(title);

/** "49,90", "R$ 49,90", "49.9", "1.299,00" -> cents; anything unclear is refused rather than guessed. */
export function parseTarget(text: string): number | undefined {
  let t = text.replace(/R\$|\s/g, "");
  if (!/^\d[\d.,]*$/.test(t)) return undefined;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  const sep = Math.max(lastComma, lastDot);
  const decimals = sep >= 0 ? t.length - sep - 1 : 0;
  if (sep >= 0 && decimals > 0 && decimals <= 2) {
    t = t.slice(0, sep).replace(/[.,]/g, "") + "." + t.slice(sep + 1);
  } else if (/[.,]/.test(t)) {
    // only the Brazilian "." groups thousands ("1.299"); "12,345" is ambiguous, so it is refused
    if (!/^\d{1,3}(\.\d{3})+$/.test(t)) return undefined;
    t = t.replace(/[.,]/g, "");
  }
  const cents = Math.round(Number(t) * 100);
  return Number.isFinite(cents) && cents > 0 && cents <= MAX_CENTS ? cents : undefined;
}

/** Offers at or below a target of the same currency; the cheapest per title, deepest saving first. */
export function alertHits(items: { title: string; store: string; finalCents?: number; currency: string }[], targets: PriceTargets): AlertHit[] {
  const best = new Map<string, AlertHit>();
  for (const it of items) {
    const key = targetKey(it.title);
    const t = Object.hasOwn(targets, key) ? targets[key] : undefined;
    if (!t || it.finalCents === undefined || it.currency !== t.currency || it.finalCents > t.cents) continue;
    const prev = best.get(key);
    if (!prev || it.finalCents < prev.finalCents) best.set(key, { title: it.title, store: it.store, finalCents: it.finalCents, targetCents: t.cents, currency: t.currency });
  }
  return [...best.values()].sort((a, b) => (b.targetCents - b.finalCents) - (a.targetCents - a.finalCents) || a.title.localeCompare(b.title));
}

/** Storage is untrusted: keep only entries with a positive integer price, an ISO-style currency and a title. */
export function sanitizeTargets(raw: unknown): PriceTargets {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: PriceTargets = {};
  for (const [key, v] of Object.entries(raw)) {
    // Keys are folded titles; anything else (including "__proto__") is not ours.
    if (!key || key !== fold(key) || typeof v !== "object" || v === null) continue;
    const { cents, currency, title } = v as Record<string, unknown>;
    if (typeof cents === "number" && Number.isInteger(cents) && cents > 0 && cents <= MAX_CENTS && typeof currency === "string" && /^[A-Z]{3}$/.test(currency) && typeof title === "string" && title && title.length <= 300) {
      out[key] = { cents, currency, title };
    }
  }
  return out;
}
