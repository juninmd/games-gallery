import type { DetectedEntry } from "../domain/types";
import { httpGetJson } from "./http";

/** SteamID64 and Web API key shapes are validated before a key ever leaves the app. */
export const STEAM_ID = /^\d{17}$/;
export const STEAM_KEY = /^[A-Fa-f0-9]{32}$/;

export const isValidSteamId = (value: string) => STEAM_ID.test(value.trim());
export const isValidSteamKey = (value: string) => STEAM_KEY.test(value.trim());

interface OwnedGamesResponse {
  response?: {
    game_count?: number;
    games?: Array<{ appid?: number; name?: string; playtime_forever?: number }>;
  };
}

/** `IPlayerService/GetOwnedGames`: the whole account library with total playtime, in minutes. */
export async function fetchOwnedGames(steamId: string, key: string): Promise<DetectedEntry[]> {
  const id = steamId.trim();
  const apiKey = key.trim();
  if (!isValidSteamId(id)) throw new Error("SteamID64 inválido: informe os 17 dígitos.");
  if (!isValidSteamKey(apiKey)) throw new Error("Chave da Steam Web API inválida: 32 caracteres hexadecimais.");
  const qs = new URLSearchParams({
    key: apiKey,
    steamid: id,
    include_appinfo: "1",
    include_played_free_games: "1",
    format: "json",
  });
  const json = (await httpGetJson(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?${qs}`)) as OwnedGamesResponse;
  const games = json.response?.games ?? [];
  return games.flatMap((g): DetectedEntry[] => {
    const appId = g.appid;
    const title = g.name?.trim();
    if (!appId || !Number.isInteger(appId) || appId <= 0 || !title) return [];
    const minutes = typeof g.playtime_forever === "number" && g.playtime_forever > 0 ? g.playtime_forever : 0;
    return [{
      storeId: String(appId),
      title,
      installed: false,
      playtimeH: Math.round((minutes / 60) * 10) / 10,
    }];
  });
}

/** `IStoreBrowseService/GetItems` URL: names, prices (and optionally reviews) for many apps in one call. */
export function storeBrowseUrl(appIds: number[], dataRequest: Record<string, boolean>, country = "BR"): string {
  const input = { ids: appIds.map((appid) => ({ appid })), context: { language: "portuguese", country_code: country }, data_request: dataRequest };
  return `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?${new URLSearchParams({ input_json: JSON.stringify(input) })}`;
}
