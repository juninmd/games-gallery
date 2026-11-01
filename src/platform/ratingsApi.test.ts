import { describe, expect, it } from "vitest";
import { steamScores } from "./ratingsApi";

const browse = { response: { store_items: [{ appid: 570, success: 1, reviews: { summary_filtered: { review_count: 100, percent_positive: 80, review_score_label: "Muito positivas" } } }] } };
const legacy = { success: 1, query_summary: { total_positive: 9, total_negative: 1, review_score_desc: "Overwhelmingly Positive" } };

describe("steamScores", () => {
  it("prefers the API host and never touches the legacy endpoint when it answers", async () => {
    const urls: string[] = [];
    const out = await steamScores(570, async (u) => { urls.push(u); return browse; });
    expect(out[0]).toMatchObject({ score: 80, detail: "Muito positivas" });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("api.steampowered.com");
  });
  it("falls back to appreviews when the API fails or has no summary", async () => {
    const viaError = await steamScores(570, async (u) => { if (u.includes("api.steampowered")) throw new Error("HTTP 500"); return legacy; });
    expect(viaError[0]?.score).toBe(90);
    const viaEmpty = await steamScores(570, async (u) => (u.includes("api.steampowered") ? { response: { store_items: [] } } : legacy));
    expect(viaEmpty[0]?.score).toBe(90);
  });
  it("propagates the failure when both endpoints fail, and returns [] for an unreviewed game", async () => {
    await expect(steamScores(570, async () => { throw new Error("HTTP 302"); })).rejects.toThrow("HTTP 302");
    expect(await steamScores(570, async () => ({ success: 1, query_summary: { total_positive: 0, total_negative: 0 } }))).toEqual([]);
  });
});
