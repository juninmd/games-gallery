import { parseRawg, parseSteamBrowseReviews, parseSteamReviews, steamAppIdOf, type PublicScore, type RatingsEntry } from "../domain/ratings";
import type { Game } from "../domain/types";
import { httpGetJson } from "./http";
import { storeBrowseUrl } from "./steamApi";

type GetJson = (url: string) => Promise<unknown>;

/**
 * The API host answers reliably; `store.steampowered.com/appreviews` started redirecting to the
 * store home for some clients, so it is only the fallback.
 */
export async function steamScores(appId: number, get: GetJson = httpGetJson): Promise<PublicScore[]> {
  try {
    const viaApi = parseSteamBrowseReviews(await get(storeBrowseUrl([appId], { include_reviews: true })), appId);
    if (viaApi) return [viaApi];
  } catch {
    // fall through to the legacy endpoint
  }
  const url = `https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all&num_per_page=0`;
  const score = parseSteamReviews(await get(url));
  return score ? [score] : [];
}

async function rawgScores(title: string, key: string): Promise<PublicScore[]> {
  const qs = new URLSearchParams({ key, search: title, search_precise: "true", page_size: "5" });
  return parseRawg(await httpGetJson(`https://api.rawg.io/api/games?${qs}`), title);
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Queries every configured source; a failing source is reported, never thrown. */
export async function fetchPublicRatings(game: Game, rawgKey: string | null, opts: { steam?: boolean } = {}): Promise<RatingsEntry> {
  const scores: PublicScore[] = [];
  const errors: string[] = [];
  const appId = steamAppIdOf(game);

  const jobs: Promise<void>[] = [];
  if (appId && opts.steam !== false) {
    jobs.push(steamScores(appId).then((s) => void scores.push(...s)).catch((e) => void errors.push(`Steam: ${msg(e)}`)));
  }
  if (rawgKey) {
    jobs.push(rawgScores(game.title, rawgKey).then((s) => void scores.push(...s)).catch((e) => void errors.push(`RAWG: ${msg(e)}`)));
  }
  await Promise.all(jobs);
  return { fetchedAt: Date.now(), scores, errors };
}
