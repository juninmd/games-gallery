import { type Deal, type WishlistEntry, buildWishlist, parseEpicDeals, parseGogDeals, parseSteamSpecials, parseStoreItems, parseWishlist } from "../domain/deals";
import { isValidSteamId, isValidSteamKey, storeBrowseUrl } from "./steamApi";
import { httpGetJson } from "./http";

export type GetJson = (url: string) => Promise<unknown>;

/** Prices are shown in BRL; one constant keeps the three stores on the same currency. */
export const STORE_COUNTRY = "BR";
export const STORE_CURRENCY = "BRL";

const STEAM_SPECIALS = `https://store.steampowered.com/api/featuredcategories?cc=${STORE_COUNTRY.toLowerCase()}&l=portuguese`;
// GOG's catalog answers an empty page for pt-BR locales; en-US with BRL prices is the working combination.
const GOG_DEALS = `https://catalog.gog.com/v1/catalog?limit=48&order=desc:trending&discounted=eq:true&productType=in:game,pack&countryCode=${STORE_COUNTRY}&locale=en-US&currencyCode=${STORE_CURRENCY}`;
const EPIC_PROMOS = `https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=pt-BR&country=${STORE_COUNTRY}&allowCountries=${STORE_COUNTRY}`;
const WISHLIST_CHUNK = 50;

export const fetchSteamDeals = async (get: GetJson = httpGetJson): Promise<Deal[]> => parseSteamSpecials(await get(STEAM_SPECIALS));
export const fetchGogDeals = async (get: GetJson = httpGetJson): Promise<Deal[]> => parseGogDeals(await get(GOG_DEALS));
export const fetchEpicDeals = async (get: GetJson = httpGetJson): Promise<Deal[]> => parseEpicDeals(await get(EPIC_PROMOS));

/**
 * The account's Steam wishlist with live prices. A profile with private game details answers an
 * empty list; that is reported as `[]`, and the caller explains how to make it public.
 */
export async function fetchWishlist(steamId: string, key: string, get: GetJson = httpGetJson): Promise<WishlistEntry[]> {
  const id = steamId.trim();
  if (!isValidSteamId(id)) throw new Error("SteamID64 inválido: informe os 17 dígitos.");
  const qs = new URLSearchParams({ steamid: id });
  if (isValidSteamKey(key)) qs.set("key", key.trim());
  const ids = parseWishlist(await get(`https://api.steampowered.com/IWishlistService/GetWishlist/v1/?${qs}`));

  const info = new Map<number, ReturnType<typeof parseStoreItems> extends Map<number, infer V> ? V : never>();
  for (let i = 0; i < ids.length; i += WISHLIST_CHUNK) {
    const chunk = ids.slice(i, i + WISHLIST_CHUNK).map((w) => w.appId);
    for (const [appId, value] of parseStoreItems(await get(storeBrowseUrl(chunk, {}, STORE_COUNTRY)))) info.set(appId, value);
  }
  return buildWishlist(ids, info, STORE_CURRENCY);
}
