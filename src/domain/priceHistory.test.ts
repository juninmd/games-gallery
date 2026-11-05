import { describe, expect, it } from "vitest";
import { MAX_ENTRIES, MAX_POINTS, dayOf, historyKey, isLowestSeen, lowestSeen, priceDrops, recordPrices, sanitizeHistory, type PriceHistory } from "./priceHistory";

const DAY = 86_400_000;
const obs = (cents: number, over: Partial<{ store: string; title: string; currency: string }> = {}) => ({ store: "steam", title: "Hades", currency: "BRL", cents, ...over });
const KEY = historyKey("steam", "Hades", "BRL");

describe("recordPrices", () => {
  it("starts a series, ignores an unchanged price and returns the same object", () => {
    const a = recordPrices({}, [obs(5000)], 10 * DAY);
    expect(a[KEY]).toEqual({ title: "Hades", points: [[10, 5000]] });
    expect(recordPrices(a, [obs(5000)], 12 * DAY)).toBe(a);
  });
  it("records every change, even twice in one day, so the last point is always the price now", () => {
    let h = recordPrices({}, [obs(5000)], 10 * DAY);
    h = recordPrices(h, [obs(2500)], 11 * DAY);
    h = recordPrices(h, [obs(3000)], 11 * DAY + 5000);
    expect(h[KEY]!.points).toEqual([[10, 5000], [11, 2500], [11, 3000]]);
    h = recordPrices(h, [obs(2400)], 11 * DAY + 9000);
    expect(h[KEY]!.points.at(-1)).toEqual([11, 2400]);
  });
  it("does not call a price the lowest, or a drop, after a same-day sale ended", () => {
    let h = recordPrices({}, [obs(5000)], 10 * DAY);
    h = recordPrices(h, [obs(3000)], 11 * DAY);
    h = recordPrices(h, [obs(5000)], 11 * DAY + 60_000);
    expect(isLowestSeen(h[KEY])).toBe(false);
    expect(priceDrops(h, 10)).toEqual([]);
  });
  it("does not mutate the input history", () => {
    const base: PriceHistory = { [KEY]: { title: "Hades", points: [[1, 100]] } };
    const copy = JSON.stringify(base);
    recordPrices(base, [obs(50)], 5 * DAY);
    expect(JSON.stringify(base)).toBe(copy);
  });
  it("keeps stores and currencies apart and skips invalid observations", () => {
    const h = recordPrices({}, [obs(100, { store: "gog" }), obs(200, { currency: "USD" }), obs(-1), obs(1.5), obs(3, { currency: "br" }), obs(4, { store: "evil" }), obs(5, { title: "™ ®" })], DAY);
    expect(Object.keys(h).sort()).toEqual([historyKey("gog", "Hades", "BRL"), historyKey("steam", "Hades", "USD")].sort());
  });
  it("bounds a series and the number of titles", () => {
    let h: PriceHistory = {};
    for (let i = 0; i < MAX_POINTS + 20; i++) h = recordPrices(h, [obs(10_000 - i)], (i + 1) * DAY);
    expect(h[KEY]!.points).toHaveLength(MAX_POINTS);
    expect(h[KEY]!.points.at(-1)![1]).toBe(10_000 - (MAX_POINTS + 19));
    const many = Array.from({ length: MAX_ENTRIES + 25 }, (_, i) => obs(100, { title: `Game ${i}` }));
    expect(Object.keys(recordPrices({}, many, DAY))).toHaveLength(MAX_ENTRIES);
  });
});

describe("lowest seen", () => {
  const e = { title: "Hades", points: [[1, 5000], [2, 2500], [3, 4000]] as [number, number][] };
  it("finds the minimum and its day", () => {
    expect(lowestSeen(e)).toEqual({ cents: 2500, day: 2 });
    expect(lowestSeen(undefined)).toBeUndefined();
  });
  it("flags only a current price that is the lowest and was higher before", () => {
    expect(isLowestSeen(e)).toBe(false);
    expect(isLowestSeen({ ...e, points: [[1, 5000], [2, 4000], [3, 2500]] })).toBe(true);
    expect(isLowestSeen({ title: "x", points: [[1, 100]] })).toBe(false);
    expect(isLowestSeen({ title: "x", points: [[1, 100], [2, 100]] })).toBe(false);
  });
});

describe("priceDrops", () => {
  it("lists drops after the given day, deepest first, and skips rises", () => {
    const h: PriceHistory = {
      [historyKey("steam", "A", "BRL")]: { title: "A", points: [[1, 1000], [9, 800]] },
      [historyKey("gog", "B", "BRL")]: { title: "B", points: [[1, 1000], [9, 400]] },
      [historyKey("epic", "C", "BRL")]: { title: "C", points: [[1, 1000], [9, 1200]] },
      [historyKey("steam", "D", "BRL")]: { title: "D", points: [[1, 1000], [3, 100]] },
    };
    expect(priceDrops(h, 5).map((d) => d.title)).toEqual(["B", "A"]);
    expect(priceDrops(h, 5)[0]).toMatchObject({ store: "gog", currency: "BRL", from: 1000, to: 400, day: 9 });
  });
});

describe("sanitizeHistory", () => {
  it("drops forged keys, malformed points and out-of-order days", () => {
    const raw = JSON.parse(`{
      "__proto__": {"title": "x", "points": [[1, 2]]},
      "bad key": {"title": "x", "points": [[1, 2]]},
      "${KEY}": {"title": "Hades", "points": [[5, 100], [4, 90], [6, -1], [7, 1.5], "x", [8, 50]]},
      "steam|empty|BRL": {"title": "", "points": [[1, 2]]}
    }`);
    const h = sanitizeHistory(raw);
    expect(Object.keys(h)).toEqual([KEY]);
    expect(h[KEY]!.points).toEqual([[5, 100], [8, 50]]);
  });
  it("round-trips what recordPrices produced and tolerates junk roots", () => {
    const h = recordPrices({}, [obs(100)], dayOf(0) + DAY);
    expect(sanitizeHistory(JSON.parse(JSON.stringify(h)))).toEqual(h);
    expect(sanitizeHistory(null)).toEqual({});
    expect(sanitizeHistory([1, 2])).toEqual({});
  });
});
