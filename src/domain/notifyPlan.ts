import type { Freebie } from "./freebies";
import { formatMoney } from "./deals";
import type { AlertHit } from "./priceAlerts";
import { fold } from "./scan/fold";

/** Memory of what was already announced is bounded: the oldest entries are forgotten first. */
export const MAX_REMEMBERED = 200;

export const hitKey = (h: AlertHit): string => `${fold(h.title)}|${h.store}|${h.currency}|${h.finalCents}`;

/** Price-target hits that were not announced before. A lower price later is a new event; the same price is not. */
export function newHits(hits: AlertHit[], announced: string[]): { fresh: AlertHit[]; announced: string[] } {
  const known = new Set(announced);
  const fresh = hits.filter((h) => !known.has(hitKey(h)));
  return { fresh, announced: [...announced, ...fresh.map(hitKey)].slice(-MAX_REMEMBERED) };
}

/**
 * Epic giveaways running now that were not seen before. The first run (`seen` undefined) only records
 * what is there, so turning notifications on does not fire an alert for something already known.
 */
export function newFreebies(items: Freebie[], seen: string[] | undefined): { fresh: Freebie[]; seen: string[] } {
  const now = items.filter((f) => f.store === "epic" && f.status === "now");
  const ids = now.map((f) => f.id);
  if (seen === undefined) return { fresh: [], seen: ids.slice(-MAX_REMEMBERED) };
  const known = new Set(seen);
  return { fresh: now.filter((f) => !known.has(f.id)), seen: [...seen, ...ids.filter((id) => !known.has(id))].slice(-MAX_REMEMBERED) };
}

const MAX_TITLE = 60;
const clip = (s: string) => (s.length > MAX_TITLE ? `${s.slice(0, MAX_TITLE - 1)}…` : s);

export function hitMessage(hits: AlertHit[]): { title: string; body: string } {
  const first = hits[0]!;
  const one = `${clip(first.title)} por ${formatMoney(first.finalCents, first.currency)} (${first.store})`;
  return hits.length === 1
    ? { title: "Preço-alvo atingido", body: one }
    : { title: `${hits.length} jogos no preço-alvo`, body: `${one} e mais ${hits.length - 1}` };
}

export function freebieMessage(items: Freebie[]): { title: string; body: string } {
  const first = items[0]!;
  return items.length === 1
    ? { title: "Jogo grátis na Epic", body: clip(first.title) }
    : { title: `${items.length} jogos grátis na Epic`, body: `${clip(first.title)} e mais ${items.length - 1}` };
}
