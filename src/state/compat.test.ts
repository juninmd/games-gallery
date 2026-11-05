import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const mem = new Map<string, string>();
  const localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  Object.assign(globalThis, { localStorage, window: { localStorage } });
});

vi.mock("../platform/compatApi", () => ({
  fetchProton: vi.fn(),
  fetchDeck: vi.fn(),
  fetchGamePassTitles: vi.fn(),
}));

import * as api from "../platform/compatApi";
import { COMPAT_TTL_MS, sanitizeCompat, sanitizeGamePass, useCompat } from "./compat";

const proton = vi.mocked(api.fetchProton);
const deck = vi.mocked(api.fetchDeck);
const pass = vi.mocked(api.fetchGamePassTitles);

beforeEach(() => {
  vi.clearAllMocks();
  useCompat.setState({ entries: {}, gamePass: undefined, error: undefined });
});

describe("sanitizeCompat / sanitizeGamePass", () => {
  it("keeps numeric ids with known tiers and statuses, and distinguishes null (no data) from absent", () => {
    const out = sanitizeCompat({
      "1245620": { at: 5, proton: { tier: "gold", total: 3 }, deck: "verified" },
      "7": { at: 1, proton: null, deck: null },
      "__proto__": { at: 1 }, "abc": { at: 1 }, "0": { at: 1 }, "9": { at: "x" },
      "11": { at: 2, proton: { tier: "diamond", total: 1 }, deck: "bogus" },
    });
    expect(Object.keys(out).sort()).toEqual(["11", "1245620", "7"]);
    expect(out["7"]).toEqual({ at: 1, proton: null, deck: null });
    expect(out["11"]).toEqual({ at: 2 });
  });
  it("bounds and filters the Game Pass keys", () => {
    expect(sanitizeGamePass({ at: 1, keys: ["a", 3, "", "b"] })).toEqual({ at: 1, keys: ["a", "b"] });
    expect(sanitizeGamePass({ at: "1", keys: [] })).toBeUndefined();
    expect(sanitizeGamePass(null)).toBeUndefined();
  });
});

describe("load", () => {
  it("stores both answers and does not ask again inside the TTL", async () => {
    proton.mockResolvedValue({ tier: "gold", total: 10 });
    deck.mockResolvedValue("playable");
    await useCompat.getState().load(10);
    await useCompat.getState().load(10);
    expect(useCompat.getState().entries["10"]).toMatchObject({ proton: { tier: "gold", total: 10 }, deck: "playable" });
    expect(proton).toHaveBeenCalledTimes(1);
  });
  it("remembers 'no data' as null so a title without reports is not re-queried every visit", async () => {
    proton.mockResolvedValue(null);
    deck.mockResolvedValue(null);
    await useCompat.getState().load(11);
    expect(useCompat.getState().entries["11"]).toMatchObject({ proton: null, deck: null });
    await useCompat.getState().load(11);
    expect(proton).toHaveBeenCalledTimes(1);
  });
  it("keeps what one source answered when the other fails, and caches nothing when both fail", async () => {
    proton.mockRejectedValue(new Error("down"));
    deck.mockResolvedValue("verified");
    await useCompat.getState().load(12);
    expect(useCompat.getState().entries["12"]).toEqual(expect.objectContaining({ deck: "verified" }));
    expect(useCompat.getState().entries["12"]).not.toHaveProperty("proton");

    deck.mockRejectedValue(new Error("down"));
    await useCompat.getState().load(13);
    expect(useCompat.getState().entries["13"]).toBeUndefined();
  });
  it("refreshes after the TTL", async () => {
    proton.mockResolvedValue({ tier: "gold", total: 1 });
    deck.mockResolvedValue("verified");
    useCompat.setState({ entries: { "14": { at: Date.now() - COMPAT_TTL_MS - 1, proton: null, deck: null } } });
    await useCompat.getState().load(14);
    expect(proton).toHaveBeenCalledTimes(1);
  });
  it("shares one request between concurrent callers", async () => {
    proton.mockResolvedValue(null);
    deck.mockResolvedValue(null);
    await Promise.all([useCompat.getState().load(15), useCompat.getState().load(15)]);
    expect(proton).toHaveBeenCalledTimes(1);
  });
});

describe("loadGamePass", () => {
  it("keeps folded, deduplicated keys and records a failure without wiping the cache", async () => {
    pass.mockResolvedValueOnce(["Hades", "HADES™", "9 Kings (Game Preview)"]);
    await useCompat.getState().loadGamePass();
    expect(useCompat.getState().gamePass?.keys.sort()).toEqual(["9kings", "hades"]);
    const before = useCompat.getState().gamePass;
    useCompat.setState({ gamePass: { at: 0, keys: ["old"] } });
    pass.mockRejectedValueOnce(new Error("offline"));
    await useCompat.getState().loadGamePass();
    expect(useCompat.getState().gamePass?.keys).toEqual(["old"]);
    expect(useCompat.getState().error).toBe("offline");
    expect(before).toBeDefined();
  });
});
