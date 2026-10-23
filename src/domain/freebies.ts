import { fold, slug } from "./scan/fold";
import type { Game } from "./types";

export type FreebieStore = "epic" | "psplus";

export interface Freebie {
  /** Stable across fetches: `epic:<offer id>` / `psplus:<month>:<slug>`. */
  id: string;
  store: FreebieStore;
  title: string;
  imageUrl?: string;
  /** Store or announcement page (https, allow-listed host). */
  url: string;
  /** Epic: promotion window. PS Plus: only `startsAt` (post date). */
  startsAt?: string;
  endsAt?: string;
  status: "now" | "upcoming" | "monthly";
  /** Epic only: regular price shown as "de R$ x". */
  originalPrice?: string;
}

export interface PsPlusMonth {
  month: string;
  postUrl: string;
  publishedAt: string;
  games: string[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);
const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;

/** Hosts whose images and pages the app will show or open. */
const IMAGE_HOSTS = new Set(["cdn1.epicgames.com"]);
export const LINK_HOSTS = new Set(["store.epicgames.com", "blog.playstation.com", "store.playstation.com"]);

export function safeUrl(url: string | undefined, hosts: Set<string>): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password && hosts.has(u.host) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

function epicPageSlug(el: Record<string, unknown>): string | undefined {
  const mapping = (v: unknown) => arr(v).flatMap((m) => (isObj(m) && m["pageType"] === "productHome" && str(m["pageSlug"]) ? [m["pageSlug"] as string] : []))[0];
  const ns = isObj(el["catalogNs"]) ? el["catalogNs"]["mappings"] : undefined;
  const candidate = mapping(el["offerMappings"]) ?? mapping(ns) ?? str(el["productSlug"])?.replace(/\/home$/, "");
  return candidate && SLUG.test(candidate) ? candidate : undefined;
}

function formatPrice(total: unknown): string | undefined {
  if (!isObj(total)) return undefined;
  const cents = total["originalPrice"];
  const currency = str(total["currencyCode"]);
  const decimals = isObj(total["currencyInfo"]) && typeof total["currencyInfo"]["decimals"] === "number" ? total["currencyInfo"]["decimals"] : 2;
  if (typeof cents !== "number" || !Number.isFinite(cents) || cents <= 0 || !currency || !/^[A-Z]{3}$/.test(currency)) return undefined;
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 10 ** decimals);
  } catch {
    return undefined;
  }
}

/**
 * Epic `freeGamesPromotions` payload -> offers that are 100% off, current or upcoming.
 * In that payload `discountPercentage` is the share still paid: 0 means free, 20 is only 20% off.
 */
export function parseEpicFree(json: unknown): Freebie[] {
  const path = isObj(json) && isObj(json["data"]) && isObj(json["data"]["Catalog"]) && isObj(json["data"]["Catalog"]["searchStore"]);
  if (!path) return [];
  const elements = arr(((json as { data: { Catalog: { searchStore: Record<string, unknown> } } }).data.Catalog.searchStore)["elements"]);
  const out: Freebie[] = [];
  const seen = new Set<string>();

  for (const el of elements) {
    if (!isObj(el)) continue;
    const id = str(el["id"]);
    const title = str(el["title"])?.trim();
    const promotions = isObj(el["promotions"]) ? el["promotions"] : null;
    if (!id || !title || !promotions || seen.has(id)) continue;

    const free = (groups: unknown, status: "now" | "upcoming") =>
      arr(groups).flatMap((g) => (isObj(g) ? arr(g["promotionalOffers"]) : []))
        .flatMap((o) => (isObj(o) && isObj(o["discountSetting"]) && o["discountSetting"]["discountPercentage"] === 0 ? [{ o, status }] : []));
    // A game can be free now and again later; the current window wins.
    const hit = [...free(promotions["promotionalOffers"], "now"), ...free(promotions["upcomingPromotionalOffers"], "upcoming")][0];
    if (!hit) continue;

    const pageSlug = epicPageSlug(el);
    const images = arr(el["keyImages"]).flatMap((k) => (isObj(k) ? [{ type: str(k["type"]), url: str(k["url"]) }] : []));
    const image = images.find((i) => i.type === "OfferImageTall") ?? images.find((i) => i.type === "Thumbnail") ?? images.find((i) => i.type === "OfferImageWide");
    seen.add(id);
    out.push({
      id: `epic:${id}`,
      store: "epic",
      title,
      imageUrl: safeUrl(image?.url, IMAGE_HOSTS),
      url: pageSlug ? `https://store.epicgames.com/pt-BR/p/${pageSlug}` : "https://store.epicgames.com/pt-BR/free-games",
      startsAt: str(hit.o["startDate"]),
      endsAt: str(hit.o["endDate"]),
      status: hit.status,
      originalPrice: isObj(el["price"]) ? formatPrice(el["price"]["totalPrice"]) : undefined,
    });
  }
  return out.sort((a, b) => Number(a.status === "upcoming") - Number(b.status === "upcoming") || (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
}

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => safeCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n: string) => NAMED[n.toLowerCase()] ?? m);
}

const safeCodePoint = (n: number) => (Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "");

export interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
}

/** WordPress RSS 2.0: regex over `<item>` blocks (no DOMParser, so it also runs under node tests). Bounded input. */
export function parseFeed(xml: string): FeedItem[] {
  const out: FeedItem[] = [];
  for (const block of xml.slice(0, 3_000_000).match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    const tag = (name: string) => decodeEntities(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block)?.[1] ?? "").trim();
    const title = tag("title");
    const link = tag("link");
    if (title && link) out.push({ title, link, pubDate: tag("pubDate") });
  }
  return out;
}

// "PlayStation Plus Monthly Games for October: A, B, C"; the blog has used ':' and dashes.
const MONTHLY = /^PlayStation Plus Monthly Games for ([A-Za-z]+)\s*[:–—-]\s*(.+)$/;

/** Newest monthly-games announcement in a feed page, or null. Game names are split from the post title. */
export function findPsPlusMonth(items: FeedItem[]): PsPlusMonth | null {
  for (const it of items) {
    const m = MONTHLY.exec(it.title);
    const postUrl = safeUrl(it.link, LINK_HOSTS);
    if (!m || !postUrl) continue;
    const games = (m[2] ?? "")
      .split(/,\s+(?:and\s+)?|\s+and\s+/)
      .map((g) => g.trim())
      .filter((g) => g.length > 0 && g.length <= 80)
      .slice(0, 8);
    if (!games.length) continue;
    const date = new Date(it.pubDate);
    return { month: m[1] ?? "", postUrl, publishedAt: Number.isNaN(date.getTime()) ? "" : date.toISOString(), games };
  }
  return null;
}

export function psPlusFreebies(month: PsPlusMonth): Freebie[] {
  return month.games.map((title) => ({
    id: `psplus:${month.month.toLowerCase()}:${slug(title)}`,
    store: "psplus",
    title,
    url: month.postUrl,
    startsAt: month.publishedAt || undefined,
    status: "monthly",
  }));
}

const MONTHS_PT: Record<string, string> = {
  january: "janeiro", february: "fevereiro", march: "março", april: "abril", may: "maio", june: "junho",
  july: "julho", august: "agosto", september: "setembro", october: "outubro", november: "novembro", december: "dezembro",
};

/** English month from the blog title -> pt-BR; unknown names pass through unchanged. */
export const monthPt = (m: string) => MONTHS_PT[m.toLowerCase()] ?? m;

export const PS_PLUS_PLATFORMS = ["ps5", "ps4"] as const;

export type AddMode = "wishlist" | "owned";

/** Game for the library, or null when the same title already exists for that store/platform. */
export function freebieToGame(f: Freebie, mode: AddMode, existing: Game[], platformId = "pc"): Game | null {
  const providerId = f.store === "epic" ? "epic" : "psplus";
  const platform = f.store === "epic" ? "pc" : platformId;
  if (existing.some((g) => g.platformId === platform && g.providerId === providerId && fold(g.title) === fold(f.title))) return null;
  const taken = new Set(existing.map((g) => g.id));
  let id = `free-${f.store}-${slug(f.title) || "game"}`;
  for (let n = 2; taken.has(id); n++) id = `free-${f.store}-${slug(f.title) || "game"}-${n}`;
  return {
    id, title: f.title, platformId: platform, providerId, year: 0, genres: [],
    coverUrl: f.imageUrl, status: mode === "owned" ? "backlog" : "wishlist", owned: mode === "owned", installed: false, playtimeH: 0,
    notes: f.store === "epic" ? "Jogo gratuito da Epic Games Store" : `PlayStation Plus: jogos do mês (${f.url})`,
  };
}
