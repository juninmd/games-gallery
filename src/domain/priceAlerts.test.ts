import { describe, expect, it } from "vitest";
import { alertHits, parseTarget, sanitizeTargets, targetKey, type PriceTargets } from "./priceAlerts";

describe("parseTarget", () => {
  it("reads Brazilian and plain decimals into cents", () => {
    expect(parseTarget("49,90")).toBe(4990);
    expect(parseTarget("R$ 49,90")).toBe(4990);
    expect(parseTarget("49.9")).toBe(4990);
    expect(parseTarget("1.299,00")).toBe(129900);
    expect(parseTarget("20")).toBe(2000);
  });
  it("refuses empty, zero, negative, absurd and non-numeric input", () => {
    for (const bad of ["", "  ", "0", "0,00", "-5", "abc", "1e9", "99999999", "12,345", "NaN"]) expect(parseTarget(bad)).toBeUndefined();
  });
});

describe("alertHits", () => {
  const targets: PriceTargets = {
    [targetKey("Hades")]: { cents: 5000, currency: "BRL", title: "Hades" },
    [targetKey("Celeste")]: { cents: 1000, currency: "BRL", title: "Celeste" },
    [targetKey("Dollar")]: { cents: 1000, currency: "USD", title: "Dollar" },
  };
  const item = (title: string, finalCents: number | undefined, currency = "BRL", store = "steam") => ({ title, finalCents, currency, store });

  it("hits when the price is at or under the target, ignoring case, accents and symbols", () => {
    const hits = alertHits([item("HÁDES™", 5000), item("Celeste", 1001), item("Other", 1)], targets);
    expect(hits.map((h) => h.title)).toEqual(["HÁDES™"]);
    expect(hits[0]).toMatchObject({ targetCents: 5000, finalCents: 5000 });
  });

  it("never compares across currencies and skips items with no price", () => {
    expect(alertHits([item("Dollar", 500, "BRL")], targets)).toEqual([]);
    expect(alertHits([item("Dollar", 500, "USD")], targets)).toHaveLength(1);
    expect(alertHits([item("Hades", undefined)], targets)).toEqual([]);
  });

  it("keeps only the cheapest offer per title and orders by how far under target", () => {
    const hits = alertHits([item("Hades", 4500, "BRL", "steam"), item("Hades", 3000, "BRL", "gog"), item("Celeste", 400, "BRL", "epic")], targets);
    expect(hits.map((h) => `${h.title}:${h.store}`)).toEqual(["Hades:gog", "Celeste:epic"]); // R$ 20 under target beats R$ 6
  });

  it("a free offer always hits a set target, but an unset title never does", () => {
    expect(alertHits([item("Hades", 0)], targets)).toHaveLength(1);
    expect(alertHits([item("Hades", 0)], {})).toEqual([]);
  });
});

describe("sanitizeTargets", () => {
  it("keeps only well-formed entries from storage", () => {
    const raw = { hades: { cents: 4000, currency: "BRL", title: "Hades" }, bad1: { cents: -1, currency: "BRL", title: "x" }, bad2: { cents: 1, currency: "brl", title: "x" }, bad3: "nope", bad4: { cents: 1, currency: "BRL" }, Bad_Key: { cents: 5, currency: "BRL", title: "x" } };
    expect(sanitizeTargets(raw)).toEqual({ hades: { cents: 4000, currency: "BRL", title: "Hades" } });
    const proto = JSON.parse('{"__proto__": {"cents": 5, "currency": "BRL", "title": "x"}}');
    expect(Object.keys(sanitizeTargets(proto))).toEqual([]);
    expect(alertHits([{ title: "Constructor", store: "steam", finalCents: 1, currency: "BRL" }], {})).toEqual([]);
    expect(sanitizeTargets(null)).toEqual({});
    expect(sanitizeTargets([1, 2])).toEqual({});
  });
});
