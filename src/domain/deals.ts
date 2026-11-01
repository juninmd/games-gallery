/** Store promotions and the Steam wishlist: pure parsers over payloads checked against the live endpoints. */

export type DealStore = "steam" | "gog" | "epic";

export interface Deal {
  /** Stable across fetches: `<store>:<id>`. */
  id: string;
  store: DealStore;
  title: string;
  url: string;
  imageUrl?: string;
  currency: string;
  /** Minor units (cents). */
  originalCents: number;
  finalCents: number;
  discountPercent: number;
  endsAt?: string;
  /** Steam app id when the deal is for a Steam game (used to flag wishlist/owned matches). */
  steamAppId?: number;
}

export interface WishlistEntry {
  appId: number;
  title: string;
  url: string;
  imageUrl?: string;
  addedAt?: number;
  priority?: number;
  /** Absent when the store has no price (unreleased, free, region-locked). */
  price?: { currency: string; originalCents: number; finalCents: number; discountPercent: number };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);
const int = (v: unknown): number | undefined => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined);
const CURRENCY = /^[A-Z]{3}$/;

export const DEAL_IMAGE_HOSTS = new Set([
  "shared.akamai.steamstatic.com",
  "cdn.akamai.steamstatic.com",
  "shared.fastly.steamstatic.com",
  "cdn.cloudflare.steamstatic.com",
  "images.gog-statics.com",
  "images-1.gog-statics.com",
  "images-2.gog-statics.com",
  "images-3.gog-statics.com",
  "images-4.gog-statics.com",
  "cdn1.epicgames.com",
  "cdn2.unrealengine.com",
]);
export const DEAL_LINK_HOSTS = new Set(["store.steampowered.com", "www.gog.com", "store.epicgames.com"]);

function safeHttps(url: string | undefined, hosts: Set<string>): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password && hosts.has(u.host) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

const SLUG = /^[a-z0-9][a-z0-9_-]{0,120}$/;

export function formatMoney(cents: number, currency: string): string {
  if (!CURRENCY.test(currency)) return `${(cents / 100).toFixed(2)}`;
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

const centsOf = (amount: unknown): number | undefined => {
  const n = typeof amount === "string" ? Number(amount) : typeof amount === "number" ? amount : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
};

const pctOf = (original: number, final: number) => (original > 0 ? Math.round((100 * (original - final)) / original) : 0);

/** `store.steampowered.com/api/featuredcategories` -> the `specials` shelf. */
export function parseSteamSpecials(json: unknown): Deal[] {
  if (!isObj(json) || !isObj(json["specials"])) return [];
  const out: Deal[] = [];
  const seen = new Set<number>();
  for (const raw of arr(json["specials"]["items"])) {
    if (!isObj(raw)) continue;
    const appId = int(raw["id"]);
    const title = str(raw["name"])?.trim();
    const original = int(raw["original_price"]);
    const final = int(raw["final_price"]);
    const currency = str(raw["currency"]);
    const percent = int(raw["discount_percent"]);
    if (!appId || appId <= 0 || !title || original === undefined || final === undefined || !currency || !CURRENCY.test(currency)) continue;
    if (!percent || percent <= 0 || seen.has(appId)) continue;
    seen.add(appId);
    const expires = int(raw["discount_expiration"]);
    out.push({
      id: `steam:${appId}`,
      store: "steam",
      title,
      url: `https://store.steampowered.com/app/${appId}`,
      imageUrl: safeHttps(str(raw["large_capsule_image"]) ?? str(raw["header_image"]), DEAL_IMAGE_HOSTS),
      currency,
      originalCents: original,
      finalCents: final,
      discountPercent: Math.min(percent, 100),
      endsAt: expires ? new Date(expires * 1000).toISOString() : undefined,
      steamAppId: appId,
    });
  }
  return out;
}

/** `catalog.gog.com/v1/catalog?discounted=eq:true` -> deals. Prices are decimal strings. */
export function parseGogDeals(json: unknown): Deal[] {
  if (!isObj(json)) return [];
  const out: Deal[] = [];
  const seen = new Set<string>();
  for (const raw of arr(json["products"])) {
    if (!isObj(raw) || !isObj(raw["price"])) continue;
    const id = str(raw["id"]);
    const title = str(raw["title"])?.trim();
    const base = isObj(raw["price"]["baseMoney"]) ? raw["price"]["baseMoney"] : undefined;
    const final = isObj(raw["price"]["finalMoney"]) ? raw["price"]["finalMoney"] : undefined;
    const currency = str(final?.["currency"]);
    const original = centsOf(base?.["amount"]);
    const price = centsOf(final?.["amount"]);
    if (!id || !/^\d{1,20}$/.test(id) || !title || !currency || !CURRENCY.test(currency) || original === undefined || price === undefined) continue;
    if (price >= original || seen.has(id)) continue;
    seen.add(id);
    const link = safeHttps(str(raw["storeLink"]), DEAL_LINK_HOSTS);
    out.push({
      id: `gog:${id}`,
      store: "gog",
      title,
      url: link ?? "https://www.gog.com/en/games?discounted=true",
      imageUrl: safeHttps(str(raw["coverHorizontal"]) ?? str(raw["coverVertical"]), DEAL_IMAGE_HOSTS),
      currency,
      originalCents: original,
      finalCents: price,
      discountPercent: pctOf(original, price),
    });
  }
  return out;
}

/** Epic `freeGamesPromotions` also carries partial discounts; those that are not free are deals. */
export function parseEpicDeals(json: unknown): Deal[] {
  const store = isObj(json) && isObj(json["data"]) && isObj(json["data"]["Catalog"]) ? json["data"]["Catalog"]["searchStore"] : undefined;
  if (!isObj(store)) return [];
  const out: Deal[] = [];
  const seen = new Set<string>();
  for (const el of arr(store["elements"])) {
    if (!isObj(el) || !isObj(el["price"]) || !isObj(el["price"]["totalPrice"])) continue;
    const id = str(el["id"]);
    const title = str(el["title"])?.trim();
    const total = el["price"]["totalPrice"];
    const original = int(total["originalPrice"]);
    const final = int(total["discountPrice"]);
    const currency = str(total["currencyCode"]);
    const offers = isObj(el["promotions"]) ? arr(el["promotions"]["promotionalOffers"]).flatMap((g) => (isObj(g) ? arr(g["promotionalOffers"]) : [])) : [];
    if (!id || !title || original === undefined || final === undefined || !currency || !CURRENCY.test(currency)) continue;
    // 0 is a giveaway (handled by the freebies list); equal prices mean the promotion is not applied.
    if (final === 0 || final >= original || !offers.length || seen.has(id)) continue;
    seen.add(id);
    const endDate = isObj(offers[0]) ? str(offers[0]["endDate"]) : undefined;
    const images = arr(el["keyImages"]).flatMap((k) => (isObj(k) ? [{ type: str(k["type"]), url: str(k["url"]) }] : []));
    const image = images.find((i) => i.type === "OfferImageTall") ?? images.find((i) => i.type === "Thumbnail") ?? images.find((i) => i.type === "OfferImageWide");
    const slug = firstSlug(el);
    out.push({
      id: `epic:${id}`,
      store: "epic",
      title,
      url: slug ? `https://store.epicgames.com/pt-BR/p/${slug}` : "https://store.epicgames.com/pt-BR/browse?sortBy=relevancy&sortDir=DESC&priceTier=tierDiscouted",
      imageUrl: safeHttps(image?.url, DEAL_IMAGE_HOSTS),
      currency,
      originalCents: original,
      finalCents: final,
      discountPercent: pctOf(original, final),
      endsAt: endDate && Number.isFinite(Date.parse(endDate)) ? endDate : undefined,
    });
  }
  return out;
}

function firstSlug(el: Record<string, unknown>): string | undefined {
  const pick = (v: unknown) =>
    arr(v).flatMap((m) => (isObj(m) && m["pageType"] === "productHome" && str(m["pageSlug"]) ? [m["pageSlug"] as string] : []))[0];
  const ns = isObj(el["catalogNs"]) ? el["catalogNs"]["mappings"] : undefined;
  const slug = pick(el["offerMappings"]) ?? pick(ns) ?? str(el["productSlug"])?.replace(/\/home$/, "");
  return slug && SLUG.test(slug) ? slug : undefined;
}

/** Biggest discount first, then cheapest; ties keep the source order. */
export function sortDeals(deals: Deal[]): Deal[] {
  return [...deals].sort((a, b) => b.discountPercent - a.discountPercent || a.finalCents - b.finalCents);
}

/** Drops expired promotions; deals without an end date are kept. */
export function liveDeals(deals: Deal[], now = Date.now()): Deal[] {
  return deals.filter((d) => !d.endsAt || Date.parse(d.endsAt) > now);
}

/** Urgency label for an offer ending within three days, from the time left (so it is time-zone proof). */
export function endingSoon(endsAt: string | undefined, now = Date.now()): string | undefined {
  const end = endsAt ? Date.parse(endsAt) : NaN;
  const hours = (end - now) / 3_600_000;
  if (!Number.isFinite(hours) || hours <= 0 || hours > 72) return undefined;
  return hours <= 24 ? "Acaba em menos de 24 h" : `Acaba em ${Math.ceil(hours / 24)} dias`;
}

/** `IWishlistService/GetWishlist` -> app ids. A private profile answers `{response:{}}`: that is empty, not an error. */
export function parseWishlist(json: unknown): Array<{ appId: number; priority?: number; addedAt?: number }> {
  if (!isObj(json) || !isObj(json["response"])) return [];
  const seen = new Set<number>();
  const out: Array<{ appId: number; priority?: number; addedAt?: number }> = [];
  for (const raw of arr(json["response"]["items"])) {
    if (!isObj(raw)) continue;
    const appId = int(raw["appid"]);
    if (!appId || appId <= 0 || seen.has(appId)) continue;
    seen.add(appId);
    const added = int(raw["date_added"]);
    out.push({ appId, priority: int(raw["priority"]), addedAt: added ? added * 1000 : undefined });
  }
  return out;
}

/** `IStoreBrowseService/GetItems` (with `include_basic_info`) -> name + price per app id. */
export function parseStoreItems(json: unknown): Map<number, { title: string; price?: WishlistEntry["price"]; imageUrl?: string }> {
  const out = new Map<number, { title: string; price?: WishlistEntry["price"]; imageUrl?: string }>();
  const items = isObj(json) && isObj(json["response"]) ? arr(json["response"]["store_items"]) : [];
  for (const raw of items) {
    if (!isObj(raw) || raw["success"] !== 1) continue;
    const appId = int(raw["appid"]);
    const title = str(raw["name"])?.trim();
    if (!appId || !title) continue;
    const option = isObj(raw["best_purchase_option"]) ? raw["best_purchase_option"] : undefined;
    const final = Number(option?.["final_price_in_cents"]);
    const original = Number(option?.["original_price_in_cents"] ?? option?.["final_price_in_cents"]);
    const pct = int(option?.["discount_pct"]) ?? 0;
    // The browse payload has no currency code; callers pass the country they asked for.
    out.set(appId, {
      title,
      price: Number.isFinite(final) && Number.isFinite(original) && final >= 0 ? { currency: "", originalCents: original, finalCents: final, discountPercent: pct } : undefined,
    });
  }
  return out;
}

/** Wishlist ids + store data -> displayable entries, on-sale first. */
export function buildWishlist(
  ids: Array<{ appId: number; priority?: number; addedAt?: number }>,
  info: Map<number, { title: string; price?: WishlistEntry["price"] }>,
  currency: string,
): WishlistEntry[] {
  const entries = ids.map((w): WishlistEntry => {
    const found = info.get(w.appId);
    const price = found?.price ? { ...found.price, currency } : undefined;
    return {
      appId: w.appId,
      title: found?.title ?? `App ${w.appId}`,
      url: `https://store.steampowered.com/app/${w.appId}`,
      imageUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${w.appId}/header.jpg`,
      priority: w.priority,
      addedAt: w.addedAt,
      price,
    };
  });
  return entries.sort(
    (a, b) =>
      (b.price?.discountPercent ?? 0) - (a.price?.discountPercent ?? 0) ||
      (a.priority || Number.MAX_SAFE_INTEGER) - (b.priority || Number.MAX_SAFE_INTEGER) ||
      a.title.localeCompare(b.title),
  );
}
