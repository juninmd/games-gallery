import type { Game } from "./types";

export type RatingSourceId = "steam" | "rawg" | "metacritic";

/** Every score is normalized to 0-100 so sources (and the user's own) are comparable. */
export interface PublicScore {
  source: RatingSourceId;
  label: string;
  score: number;
  count?: number;
  detail?: string;
  matchedTitle?: string;
}

export interface RatingsEntry {
  fetchedAt: number;
  scores: PublicScore[];
  /** Per-source failure messages, so one broken source does not hide the others. */
  errors: string[];
}

export const RATINGS_TTL_MS = 24 * 60 * 60 * 1000;

export const userScore100 = (rating?: number): number | undefined =>
  rating ? Math.round(rating * 20) : undefined;

export const isStale = (e: RatingsEntry | undefined, now = Date.now()) =>
  !e || now - e.fetchedAt > RATINGS_TTL_MS;

export function steamAppIdOf(game: Game): number | undefined {
  if (game.steamAppId) return game.steamAppId;
  if (game.providerId === "steam" && game.storeId && /^\d+$/.test(game.storeId)) return Number(game.storeId);
  return undefined;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Steam `appreviews` payload -> % of positive reviews. */
export function parseSteamReviews(json: unknown): PublicScore | null {
  if (!isObj(json) || json["success"] !== 1 || !isObj(json["query_summary"])) return null;
  const q = json["query_summary"];
  const pos = num(q["total_positive"]);
  const neg = num(q["total_negative"]);
  if (pos === undefined || neg === undefined || pos + neg === 0) return null;
  const desc = typeof q["review_score_desc"] === "string" ? q["review_score_desc"] : undefined;
  return {
    source: "steam",
    label: "Steam (versão PC)",
    score: Math.round((100 * pos) / (pos + neg)),
    count: pos + neg,
    detail: desc,
  };
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Accept only an equal or containing title: a wrong match would attribute another game's score. */
export function matchesTitle(candidate: string, wanted: string): boolean {
  const a = fold(candidate);
  const b = fold(wanted);
  return a === b || (a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a)));
}

/** RAWG `/games?search=` payload -> Metacritic score (0-100) and community rating (0-5 -> 0-100). */
export function parseRawg(json: unknown, wantedTitle: string): PublicScore[] {
  if (!isObj(json) || !Array.isArray(json["results"])) return [];
  const named = json["results"].filter((r): r is Record<string, unknown> => isObj(r) && typeof r["name"] === "string");
  // Exact title first: "Hades II" must not win over "Hades" just by containing it.
  const hit = named.find((r) => fold(String(r["name"])) === fold(wantedTitle)) ?? named.find((r) => matchesTitle(String(r["name"]), wantedTitle));
  if (!hit) return [];
  const matchedTitle = String(hit["name"]);
  const out: PublicScore[] = [];
  const meta = num(hit["metacritic"]);
  if (meta !== undefined && meta > 0) {
    out.push({ source: "metacritic", label: "Metacritic (via RAWG)", score: Math.round(meta), matchedTitle });
  }
  const rating = num(hit["rating"]);
  const count = num(hit["ratings_count"]);
  if (rating !== undefined && rating > 0) {
    out.push({ source: "rawg", label: "RAWG (comunidade)", score: Math.round(rating * 20), count, matchedTitle });
  }
  return out;
}

export function averageScore(scores: PublicScore[]): number | undefined {
  return scores.length ? Math.round(scores.reduce((s, x) => s + x.score, 0) / scores.length) : undefined;
}

export type Tone = "good" | "mixed" | "bad";
export const scoreTone = (s: number): Tone => (s >= 75 ? "good" : s >= 50 ? "mixed" : "bad");
