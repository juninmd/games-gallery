import type { DetectedEntry, Game } from "../domain/types";
import { httpGetJson } from "./http";
import { isValidSteamId } from "./steamApi";

type GetJson = (url: string) => Promise<unknown>;

/** Steam store `webapi_token`: a JWT (header.payload.signature, base64url). The Web API key cannot read family data. */
export const STEAM_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
export const STEAM_TOKEN_MAX = 1024;
export const isValidSteamToken = (value: string) => {
  const v = value.trim();
  return v.length <= STEAM_TOKEN_MAX && STEAM_TOKEN.test(v);
};

/** Where a logged-in user copies the token from (the `webapi_token` field). */
export const STEAM_TOKEN_HELP_URL = "https://store.steampowered.com/pointssummary/ajaxgetasyncconfig";

const API = "https://api.steampowered.com/IFamilyGroupsService";

interface FamilyGroupResponse { response?: { family_groupid?: string | number } }
interface SharedAppsResponse {
  response?: { apps?: Array<{ appid?: number; name?: string; owner_steamids?: Array<string | number>; exclude_reason?: number }> };
}

function friendly(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  return /^HTTP (401|403)$/.test(msg) ? new Error("token de acesso expirado ou inválido; copie um novo.") : e instanceof Error ? e : new Error(msg);
}

/**
 * Steam Families shared library: `GetFamilyGroupForUser` then `GetSharedLibraryApps`, both with the
 * user's access token. Returns only apps owned by other members and allowed to be shared.
 */
export async function fetchFamilySharedGames(steamId: string, token: string, get: GetJson = httpGetJson): Promise<DetectedEntry[]> {
  const id = steamId.trim();
  const accessToken = token.trim();
  if (!isValidSteamId(id)) throw new Error("SteamID64 inválido: informe os 17 dígitos.");
  if (!isValidSteamToken(accessToken)) throw new Error("Token de acesso da Steam inválido.");
  try {
    const group = (await get(`${API}/GetFamilyGroupForUser/v1/?${new URLSearchParams({ access_token: accessToken, steamid: id })}`)) as FamilyGroupResponse;
    const groupId = String(group.response?.family_groupid ?? "").trim();
    if (!/^\d{1,20}$/.test(groupId) || groupId === "0") return [];
    const qs = new URLSearchParams({ access_token: accessToken, family_groupid: groupId, include_own: "false", include_excluded: "false", steamid: id });
    const json = (await get(`${API}/GetSharedLibraryApps/v1/?${qs}`)) as SharedAppsResponse;
    return (json.response?.apps ?? []).flatMap((a): DetectedEntry[] => {
      const appId = a.appid;
      const title = a.name?.trim();
      if (!appId || !Number.isInteger(appId) || appId <= 0 || !title || (a.exclude_reason ?? 0) !== 0) return [];
      if ((a.owner_steamids ?? []).map(String).includes(id)) return [];
      return [{ storeId: String(appId), title, installed: false }];
    });
  } catch (e) {
    throw friendly(e);
  }
}

export const FAMILY_TAG = "Família Steam";

/** Tags Steam games borrowed from the family library so they can be filtered like any personal list. */
export function tagFamilyGames(games: Game[], family: DetectedEntry[]): Game[] {
  const ids = new Set(family.map((f) => f.storeId));
  return games.map((g) =>
    g.providerId === "steam" && g.storeId && ids.has(g.storeId) && !g.tags?.includes(FAMILY_TAG) ? { ...g, tags: [...(g.tags ?? []), FAMILY_TAG] } : g,
  );
}
