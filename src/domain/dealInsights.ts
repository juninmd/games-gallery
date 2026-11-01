import type { Deal, DealStore } from "./deals";
import { fold } from "./scan/fold";
import type { Game } from "./types";

export interface DealInsight {
  /** Provider ids of every store that already owns this game, wherever the deal is. */
  ownedIn: string[];
  /** On the in-app wishlist or the Steam wishlist. */
  wanted: boolean;
  /** Strictly the lowest price among the stores selling this title in the same currency. */
  cheapest: boolean;
  /** The same title on sale in other stores (same currency), cheapest first. */
  elsewhere: { store: DealStore; finalCents: number; currency: string }[];
}

/**
 * Crosses the three stores' promotions with the library: what you already own (in any store), what you
 * want, and where the same game is cheapest. Titles are the only common key between stores.
 */
export function dealInsights(deals: Deal[], library: Game[], wishlistTitles: string[]): Map<string, DealInsight> {
  const owners = new Map<string, Set<string>>();
  const wanted = new Set(wishlistTitles.map(fold));
  for (const g of library) {
    const key = fold(g.title);
    if (!key) continue;
    if (g.owned) owners.set(key, (owners.get(key) ?? new Set()).add(g.providerId));
    else if (g.status === "wishlist") wanted.add(key);
  }

  const byTitle = new Map<string, Deal[]>();
  for (const d of deals) {
    const key = fold(d.title);
    if (key) byTitle.set(key, [...(byTitle.get(key) ?? []), d]);
  }

  const out = new Map<string, DealInsight>();
  for (const d of deals) {
    const key = fold(d.title);
    const rivals = (byTitle.get(key) ?? []).filter((x) => x.id !== d.id && x.store !== d.store && x.currency === d.currency);
    const elsewhere = rivals.map((x) => ({ store: x.store, finalCents: x.finalCents, currency: x.currency })).sort((a, b) => a.finalCents - b.finalCents);
    out.set(d.id, {
      ownedIn: [...(owners.get(key) ?? [])],
      wanted: wanted.has(key),
      cheapest: elsewhere.length > 0 && elsewhere.every((x) => d.finalCents < x.finalCents),
      elsewhere,
    });
  }
  return out;
}

/** Wanted titles on sale that you do not own anywhere, deepest discount first. */
export function opportunities(deals: Deal[], insights: Map<string, DealInsight>): Deal[] {
  return deals
    .filter((d) => {
      const i = insights.get(d.id);
      return i && i.wanted && i.ownedIn.length === 0;
    })
    .sort((a, b) => b.discountPercent - a.discountPercent);
}
