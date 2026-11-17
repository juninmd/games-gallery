import { steamAppIdOf } from "../domain/ratings";
import type { Game } from "../domain/types";
import { httpGetJson } from "./http";

/** Client calls follow SteamGridDB's own node client (base URL, Bearer key, `dimensions`). */
const API = "https://www.steamgriddb.com/api/v2";
/** Portrait grids, the shape the library cards use. */
const PORTRAIT = "dimensions=600x900";
const CDN = "https://cdn2.steamgriddb.com/";
export const SGDB_KEY = /^[A-Za-z0-9]{16,64}$/;

export type GetJsonWithHeaders = (url: string, headers: Record<string, string>) => Promise<unknown>;

const items = (json: unknown): Record<string, unknown>[] => {
  if (typeof json !== "object" || json === null) return [];
  const { success, data } = json as Record<string, unknown>;
  return success === true && Array.isArray(data) ? data.filter((d): d is Record<string, unknown> => typeof d === "object" && d !== null) : [];
};

/** First grid served by the SteamGridDB CDN; anything else is ignored, never shown. */
export function firstGridUrl(json: unknown): string | undefined {
  for (const item of items(json)) {
    const url = item["url"];
    if (typeof url === "string" && url.startsWith(CDN) && url.length < 500) return url;
  }
  return undefined;
}

export function firstGameId(json: unknown): number | undefined {
  const id = items(json)[0]?.["id"];
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

/** A portrait cover for the game: by Steam app id when known, else by title search. */
export async function findSgdbCover(key: string, game: Pick<Game, "title" | "steamAppId" | "storeId" | "providerId">, get: GetJsonWithHeaders = httpGetJson): Promise<string | undefined> {
  if (!SGDB_KEY.test(key)) throw new Error("Chave do SteamGridDB inválida");
  const headers = { Authorization: `Bearer ${key}` };
  const appId = steamAppIdOf(game as Game);
  if (appId) {
    const hit = firstGridUrl(await get(`${API}/grids/steam/${appId}?${PORTRAIT}`, headers).catch(() => undefined));
    if (hit) return hit;
  }
  const title = game.title.trim().slice(0, 120);
  if (!title) return undefined;
  const gameId = firstGameId(await get(`${API}/search/autocomplete/${encodeURIComponent(title)}`, headers));
  if (!gameId) return undefined;
  return firstGridUrl(await get(`${API}/grids/game/${gameId}?${PORTRAIT}`, headers));
}
