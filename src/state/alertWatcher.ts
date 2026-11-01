import { alertHits, type AlertHit } from "../domain/priceAlerts";
import { liveDeals, formatMoney, type Deal, type WishlistEntry } from "../domain/deals";
import { isValidSteamId } from "../platform/steamApi";
import { useDeals } from "./deals";
import { usePriceAlerts } from "./priceAlerts";
import { useSecrets } from "./secrets";
import { useUi } from "./ui";

const STORE_NAME = { steam: "Steam", gog: "GOG", epic: "Epic" } as const;

/** Every priced offer we know of: the three stores' live deals and the Steam wishlist. */
export function currentHits(deals: Record<"steam" | "gog" | "epic", { items: Deal[] } | undefined>, wishlist: WishlistEntry[] | undefined): AlertHit[] {
  const items = [
    ...(["steam", "gog", "epic"] as const).flatMap((s) => liveDeals(deals[s]?.items ?? []).map((d) => ({ title: d.title, store: STORE_NAME[s], finalCents: d.finalCents, currency: d.currency }))),
    ...(wishlist ?? []).flatMap((w) => (w.price ? [{ title: w.title, store: "Steam", finalCents: w.price.finalCents, currency: w.price.currency }] : [])),
  ];
  return alertHits(items, usePriceAlerts.getState().targets);
}

export function recomputeHits(): AlertHit[] {
  const { deals, wishlist } = useDeals.getState();
  const hits = currentHits(deals, wishlist?.items);
  usePriceAlerts.getState().setHits(hits);
  return hits;
}

/** On app start: when any price target exists, refresh the (cached) offers and say what reached its price. */
export async function watchPriceAlerts(): Promise<void> {
  if (!Object.keys(usePriceAlerts.getState().targets).length) return;
  const d = useDeals.getState();
  const jobs = [d.refreshDeals("steam"), d.refreshDeals("gog"), d.refreshDeals("epic")];
  if (isValidSteamId(useSecrets.getState().steamId)) jobs.push(d.refreshWishlist());
  await Promise.allSettled(jobs);
  const hits = recomputeHits();
  if (!hits.length) return;
  const first = hits.slice(0, 2).map((h) => `${h.title} por ${formatMoney(h.finalCents, h.currency)} (${h.store})`).join("; ");
  useUi.getState().toast(`Preço-alvo atingido: ${first}${hits.length > 2 ? ` e mais ${hits.length - 2}` : ""}`);
}
