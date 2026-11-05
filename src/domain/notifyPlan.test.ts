import { describe, expect, it } from "vitest";
import type { Freebie } from "./freebies";
import { MAX_REMEMBERED, freebieMessage, hitKey, hitMessage, newFreebies, newHits } from "./notifyPlan";
import type { AlertHit } from "./priceAlerts";

const hit = (title: string, finalCents: number, store = "Steam"): AlertHit => ({ title, store, finalCents, targetCents: 5000, currency: "BRL" });
const free = (id: string, over: Partial<Freebie> = {}): Freebie => ({ id: `epic:${id}`, store: "epic", title: id, url: "https://store.epicgames.com/", status: "now", ...over });

describe("newHits", () => {
  it("announces a hit once, and again only when the price drops further", () => {
    const a = newHits([hit("Hades", 3000)], []);
    expect(a.fresh).toHaveLength(1);
    const b = newHits([hit("Hades", 3000)], a.announced);
    expect(b.fresh).toEqual([]);
    expect(newHits([hit("Hades", 2500)], b.announced).fresh).toHaveLength(1);
  });
  it("tells stores and spellings apart correctly", () => {
    expect(hitKey(hit("Hades™", 100))).toBe(hitKey(hit("HADES", 100)));
    expect(hitKey(hit("Hades", 100, "GOG"))).not.toBe(hitKey(hit("Hades", 100, "Steam")));
  });
  it("forgets the oldest memory past the cap", () => {
    const many = Array.from({ length: MAX_REMEMBERED + 30 }, (_, i) => hit(`G${i}`, 100));
    const r = newHits(many, []);
    expect(r.announced).toHaveLength(MAX_REMEMBERED);
    expect(r.announced.at(-1)).toBe(hitKey(many.at(-1)!));
  });
});

describe("newFreebies", () => {
  it("records the first run silently, then announces only new giveaways running now", () => {
    const first = newFreebies([free("a"), free("b")], undefined);
    expect(first.fresh).toEqual([]);
    expect(first.seen).toEqual(["epic:a", "epic:b"]);
    const next = newFreebies([free("a"), free("c"), free("d", { status: "upcoming" })], first.seen);
    expect(next.fresh.map((f) => f.id)).toEqual(["epic:c"]);
    expect(next.seen).toEqual(["epic:a", "epic:b", "epic:c"]);
  });
  it("ignores non-Epic items and an empty feed", () => {
    expect(newFreebies([free("x", { store: "psplus", status: "monthly" })], []).fresh).toEqual([]);
    expect(newFreebies([], []).fresh).toEqual([]);
  });
});

describe("messages", () => {
  it("writes one line for a single hit and a summary for several, with long titles clipped", () => {
    expect(hitMessage([hit("Hades", 3000)])).toEqual({ title: "Preço-alvo atingido", body: expect.stringContaining("Hades por ") });
    const many = hitMessage([hit("X".repeat(200), 3000), hit("Y", 100)]);
    expect(many.title).toBe("2 jogos no preço-alvo");
    expect(many.body.length).toBeLessThan(120);
    expect(many.body).toContain("e mais 1");
  });
  it("names the giveaway or counts them", () => {
    expect(freebieMessage([free("Celeste")])).toEqual({ title: "Jogo grátis na Epic", body: "Celeste" });
    expect(freebieMessage([free("a"), free("b")]).title).toBe("2 jogos grátis na Epic");
  });
});
