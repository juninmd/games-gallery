import { liveDeals, type Deal, type WishlistEntry } from "../domain/deals";
import { freebieMessage, hitMessage, newFreebies, newHits } from "../domain/notifyPlan";
import { alertHits, type AlertHit } from "../domain/priceAlerts";
import { notifyNative } from "../platform/notify";
import { isValidSteamId } from "../platform/steamApi";
import { useDeals, DEALS_TTL_MS } from "./deals";
import { useFreebies } from "./freebies";
import { usePrefs } from "./prefs";
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

/** In-app toast always; the OS notification only when the user opted in. */
async function announce(message: { title: string; body: string }): Promise<void> {
  useUi.getState().toast(`${message.title}: ${message.body}`);
  if (usePrefs.getState().notifications) await notifyNative(message.title, message.body);
}

async function checkPrices(): Promise<void> {
  if (!Object.keys(usePriceAlerts.getState().targets).length) return;
  const d = useDeals.getState();
  const jobs = [d.refreshDeals("steam"), d.refreshDeals("gog"), d.refreshDeals("epic")];
  if (isValidSteamId(useSecrets.getState().steamId)) jobs.push(d.refreshWishlist());
  await Promise.allSettled(jobs);
  const hits = recomputeHits();
  const { fresh, announced } = newHits(hits, usePrefs.getState().announcedHits);
  usePrefs.getState().remember({ announcedHits: announced });
  if (fresh.length) await announce(hitMessage(fresh));
}

async function checkFreebies(): Promise<void> {
  // Only worth a request when the user asked to be told; the Freebies screen fetches on its own.
  if (!usePrefs.getState().notifications) return;
  const f = useFreebies.getState();
  await f.refreshEpic();
  const items = useFreebies.getState().epic?.items;
  if (!items) return;
  const { fresh, seen } = newFreebies(items, usePrefs.getState().seenFreebies);
  usePrefs.getState().remember({ seenFreebies: seen });
  if (fresh.length) await announce(freebieMessage(fresh));
}

const CHECK_EVERY_MS = DEALS_TTL_MS / 6;

let running = false;

/** One pass: price targets, then giveaways. A pass already in flight is not doubled. */
export async function runChecks(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await Promise.allSettled([checkPrices(), checkFreebies()]);
  } finally {
    running = false;
  }
}

/** On app start and then while the app stays open (new data at most every 3 h for prices, 6 h for giveaways). Returns the stop function. */
export function watchPriceAlerts(): () => void {
  void runChecks();
  // Ticks are cheap: the stores' own caches (3 h deals, 6 h giveaways) decide what is really fetched.
  const timer = setInterval(() => void runChecks(), CHECK_EVERY_MS);
  return () => clearInterval(timer);
}
