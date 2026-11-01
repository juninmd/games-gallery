import { fetchEpicDeals, fetchGogDeals, fetchSteamDeals, type GetJson } from "./dealsApi";
import { httpGetJson } from "./http";
import { steamScores } from "./ratingsApi";
import { fetchOwnedGames, isValidSteamId, isValidSteamKey } from "./steamApi";

/** Live connection checks behind the "Testar" buttons: each one makes one cheap, read-only request. */
export type ProbeId = "steam-store" | "steam-api" | "steam-reviews" | "rawg" | "gog" | "epic";

export interface ProbeContext {
  steamId: string;
  steamKey: string;
  rawgKey: string;
}

export interface ProbeResult {
  ok: boolean;
  detail: string;
}

export const PROBE_LABEL: Record<ProbeId, string> = {
  "steam-store": "Steam Store (promoções)",
  "steam-api": "Steam Web API (biblioteca da conta)",
  "steam-reviews": "Steam Reviews (notas)",
  rawg: "RAWG (notas + Metacritic)",
  gog: "GOG (catálogo e promoções)",
  epic: "Epic Games Store (promoções)",
};

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const REVIEWS_PROBE_APP = 570; // Dota 2: always has thousands of reviews

export async function runProbe(id: ProbeId, ctx: ProbeContext, get: GetJson = httpGetJson): Promise<ProbeResult> {
  try {
    switch (id) {
      case "steam-store": {
        const n = (await fetchSteamDeals(get)).length;
        return n > 0 ? { ok: true, detail: `${n} ofertas lidas` } : { ok: false, detail: "Resposta sem ofertas: o formato pode ter mudado." };
      }
      case "gog": {
        const n = (await fetchGogDeals(get)).length;
        return n > 0 ? { ok: true, detail: `${n} ofertas lidas` } : { ok: false, detail: "Resposta sem ofertas: o formato pode ter mudado." };
      }
      case "epic": {
        // Zero partial discounts is a valid state; a payload without the catalog shape is not.
        const raw = await get("https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=pt-BR&country=BR&allowCountries=BR");
        const shaped = typeof raw === "object" && raw !== null && "data" in raw;
        if (!shaped) return { ok: false, detail: "Resposta fora do formato esperado." };
        return { ok: true, detail: `${(await fetchEpicDeals(async () => raw)).length} descontos parciais lidos` };
      }
      case "steam-reviews": {
        const [score] = await steamScores(REVIEWS_PROBE_APP, get);
        return score ? { ok: true, detail: `${score.detail ?? "ok"} (${score.score}%)` } : { ok: false, detail: "Resposta sem resumo de avaliações." };
      }
      case "steam-api": {
        if (!isValidSteamId(ctx.steamId) || !isValidSteamKey(ctx.steamKey)) return { ok: false, detail: "Informe SteamID64 e chave válidos antes de testar." };
        const games = await fetchOwnedGames(ctx.steamId, ctx.steamKey);
        return games.length
          ? { ok: true, detail: `${games.length} jogos na conta` }
          : { ok: false, detail: "Conta sem jogos visíveis: deixe “Detalhes do jogo” público no perfil." };
      }
      case "rawg": {
        if (!ctx.rawgKey) return { ok: false, detail: "Cole a chave do RAWG antes de testar." };
        const json = await get(`https://api.rawg.io/api/games?${new URLSearchParams({ key: ctx.rawgKey, page_size: "1" })}`);
        const ok = typeof json === "object" && json !== null && Array.isArray((json as { results?: unknown }).results);
        return ok ? { ok: true, detail: "Chave aceita" } : { ok: false, detail: "Resposta fora do formato esperado." };
      }
    }
  } catch (e) {
    const m = msg(e);
    return { ok: false, detail: /401|403/.test(m) ? `Acesso negado (${m}): confira a chave.` : m };
  }
}
