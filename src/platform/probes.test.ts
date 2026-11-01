import { describe, expect, it } from "vitest";
import { runProbe } from "./probes";

const ctx = { steamId: "", steamKey: "", rawgKey: "" };

describe("runProbe", () => {
  it("steam-store passes with offers and fails on a reshaped payload", async () => {
    const item = { id: 1, name: "G", discount_percent: 50, original_price: 100, final_price: 50, currency: "BRL" };
    expect((await runProbe("steam-store", ctx, async () => ({ specials: { items: [item] } }))).ok).toBe(true);
    const bad = await runProbe("steam-store", ctx, async () => ({ specials: { items: [] } }));
    expect(bad).toMatchObject({ ok: false });
    expect(bad.detail).toMatch(/formato/);
  });
  it("steam-reviews reads the summary", async () => {
    const r = await runProbe("steam-reviews", ctx, async () => ({ success: 1, query_summary: { total_positive: 90, total_negative: 10, review_score_desc: "Muito positivas" } }));
    expect(r).toEqual({ ok: true, detail: "Muito positivas (90%)" });
  });
  it("epic accepts an empty-but-shaped payload and rejects junk", async () => {
    expect((await runProbe("epic", ctx, async () => ({ data: { Catalog: { searchStore: { elements: [] } } } }))).ok).toBe(true);
    expect((await runProbe("epic", ctx, async () => "<html>")).ok).toBe(false);
  });
  it("credential probes refuse to run without credentials and make no request", async () => {
    let calls = 0;
    const get = async () => { calls++; return {}; };
    expect((await runProbe("steam-api", ctx, get)).detail).toMatch(/SteamID64/);
    expect((await runProbe("rawg", ctx, get)).detail).toMatch(/chave/);
    expect(calls).toBe(0);
  });
  it("rawg: a valid shape passes; HTTP 401 becomes an actionable message", async () => {
    const c = { ...ctx, rawgKey: "k" };
    expect((await runProbe("rawg", c, async () => ({ results: [] }))).ok).toBe(true);
    const denied = await runProbe("rawg", c, async () => { throw new Error("HTTP 401"); });
    expect(denied).toMatchObject({ ok: false });
    expect(denied.detail).toMatch(/Acesso negado/);
  });
  it("gog and network failures never throw", async () => {
    expect((await runProbe("gog", ctx, async () => { throw new Error("Solicitação de rede falhou"); }))).toEqual({ ok: false, detail: "Solicitação de rede falhou" });
  });
});
