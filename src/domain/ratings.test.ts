import { describe, expect, it } from "vitest";
import { averageScore, isStale, matchesTitle, parseRawg, parseSteamReviews, parseSteamBrowseReviews, steamAppIdOf, userScore100 } from "./ratings";
import { game } from "./gameFactory";

// Shape captured from the real endpoint (store.steampowered.com/appreviews/1245620?json=1).
const steamSample = {
  success: 1,
  query_summary: { num_reviews: 0, review_score: 8, review_score_desc: "Very Positive", total_positive: 1079101, total_negative: 80620, total_reviews: 1159721 },
  reviews: [],
};

describe("parseSteamReviews", () => {
  it("converts positive/negative counts into a 0-100 score", () => {
    expect(parseSteamReviews(steamSample)).toMatchObject({ source: "steam", score: 93, count: 1159721, detail: "Very Positive" });
  });

  it("returns null for games without reviews or malformed payloads", () => {
    const empty = { success: 1, query_summary: { total_positive: 0, total_negative: 0 } };
    expect(parseSteamReviews(empty)).toBeNull();
    expect(parseSteamReviews({ success: 0 })).toBeNull();
    expect(parseSteamReviews("<html>")).toBeNull();
    expect(parseSteamReviews(null)).toBeNull();
  });
});

describe("parseRawg", () => {
  const payload = { results: [{ name: "Hades II", metacritic: 95, rating: 4.5, ratings_count: 120 }, { name: "Hades", metacritic: 93, rating: 4.4, ratings_count: 900 }] };

  it("picks the exact title, not the first result", () => {
    const r = parseRawg(payload, "Hades");
    expect(r.map((x) => x.source)).toEqual(["metacritic", "rawg"]);
    expect(r[0]).toMatchObject({ score: 93, matchedTitle: "Hades" });
    expect(r[1]).toMatchObject({ score: 88, count: 900 });
  });

  it("drops a null/zero Metacritic but keeps the community rating", () => {
    const r = parseRawg({ results: [{ name: "Obscure Game", metacritic: null, rating: 3.5, ratings_count: 4 }] }, "Obscure Game");
    expect(r.map((x) => x.source)).toEqual(["rawg"]);
  });

  it("refuses an unrelated match instead of attributing the wrong score", () => {
    expect(parseRawg({ results: [{ name: "Totally Different", metacritic: 90, rating: 4 }] }, "Hades")).toEqual([]);
    expect(parseRawg({ detail: "error" }, "Hades")).toEqual([]);
  });
});

describe("helpers", () => {
  it("matches titles ignoring accents and punctuation", () => {
    expect(matchesTitle("Pokémon: Red Version", "pokemon red version")).toBe(true);
    expect(matchesTitle("Zelda", "Mario")).toBe(false);
  });

  it("normalizes the user's 1-5 stars to 0-100", () => {
    expect(userScore100(4)).toBe(80);
    expect(userScore100(undefined)).toBeUndefined();
  });

  it("averages scores and handles none", () => {
    expect(averageScore([{ source: "steam", label: "", score: 90 }, { source: "rawg", label: "", score: 80 }])).toBe(85);
    expect(averageScore([])).toBeUndefined();
  });

  it("expires the cache after 24h", () => {
    expect(isStale(undefined)).toBe(true);
    expect(isStale({ fetchedAt: 1000, scores: [], errors: [] }, 1000 + 60_000)).toBe(false);
    expect(isStale({ fetchedAt: 1000, scores: [], errors: [] }, 1000 + 25 * 3600_000)).toBe(true);
  });

  it("finds the Steam app id from the explicit field or a Steam store id", () => {
    expect(steamAppIdOf(game("pc", "steam", "X", 1, "x", { store: 620 }))).toBe(620);
    expect(steamAppIdOf(game("pc", "gog", "X", 1, "x", { store: "abc", steamAppId: 99 }))).toBe(99);
    expect(steamAppIdOf(game("ps1", "roms", "X", 1, "x"))).toBeUndefined();
  });
});

// Shape captured from IStoreBrowseService/GetItems with data_request.include_reviews (appid 570, pt-BR).
const browseSample = (reviews: unknown) => ({ response: { store_items: [{ appid: 570, success: 1, reviews }] } });

describe("parseSteamBrowseReviews", () => {
  it("reads percent_positive and the localized label for the requested app", () => {
    const json = browseSample({ summary_filtered: { review_count: 2808003, percent_positive: 80, review_score_label: "Muito positivas" } });
    expect(parseSteamBrowseReviews(json, 570)).toMatchObject({ source: "steam", score: 80, count: 2808003, detail: "Muito positivas" });
  });
  it("falls back to the unfiltered summary and ignores other apps", () => {
    const json = browseSample({ summary_unfiltered: { review_count: 10, percent_positive: 70 } });
    expect(parseSteamBrowseReviews(json, 570)?.score).toBe(70);
    expect(parseSteamBrowseReviews(json, 999)).toBeNull();
  });
  it("returns null for no reviews, out-of-range values and junk", () => {
    expect(parseSteamBrowseReviews(browseSample({ summary_filtered: { review_count: 0, percent_positive: 0 } }), 570)).toBeNull();
    expect(parseSteamBrowseReviews(browseSample({ summary_filtered: { review_count: 5, percent_positive: 140 } }), 570)).toBeNull();
    for (const bad of [null, "x", [], {}, { response: {} }, browseSample(null)]) expect(parseSteamBrowseReviews(bad, 570)).toBeNull();
  });
});
