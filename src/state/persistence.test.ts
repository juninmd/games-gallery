import { beforeEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
};

beforeEach(() => {
  values.clear();
  vi.doUnmock("../platform/ratingsApi");
  vi.resetModules();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
});

const persist = (key: string, state: unknown, version: number) => {
  values.set(key, JSON.stringify({ state, version }));
};

describe("persisted store rehydration", () => {
  it("keeps library actions and defaults when same-version game state is corrupt", async () => {
    const { useLibrary } = await import("./library");
    const originalCount = useLibrary.getState().games.length;
    persist("games-gallery:v1", { games: null, patchGame: null }, 3);
    await useLibrary.persist.rehydrate();
    expect(useLibrary.getState().games).toHaveLength(originalCount);
    expect(typeof useLibrary.getState().patchGame).toBe("function");
  });

  it("preserves a valid intentionally empty library and custom game metadata", async () => {
    const { useLibrary } = await import("./library");
    const custom = {
      id: "custom-local-1", title: "My Game", platformId: "pc", providerId: "steam", status: "backlog",
      owned: true, installed: false, year: 2024, genres: ["Custom"], playtimeH: 12, notes: "personal note",
    };
    persist("games-gallery:v1", { games: [custom], patchGame: null }, 3);
    await useLibrary.persist.rehydrate();
    expect(useLibrary.getState().games).toEqual([custom]);
    expect(typeof useLibrary.getState().patchGame).toBe("function");

    persist("games-gallery:v1", { games: [] }, 3);
    await useLibrary.persist.rehydrate();
    expect(useLibrary.getState().games).toEqual([]);
  });

  it("retains valid legacy strings and finite values above backup import limits", async () => {
    const { useLibrary } = await import("./library");
    const game = {
      id: "legacy-large", title: "T".repeat(301), platformId: "pc", providerId: "steam", status: "backlog",
      owned: true, installed: false, year: 2024, genres: ["Custom"], playtimeH: 1_000_001, romPath: "R".repeat(2001),
    };
    const settings = { romsDir: "A".repeat(1001), emulatorsDir: "B".repeat(1001) };
    persist("games-gallery:v1", { games: [game], settings }, 3);
    await useLibrary.persist.rehydrate();
    expect(useLibrary.getState().games[0]).toMatchObject(game);
    expect(useLibrary.getState().settings).toEqual(settings);
  });

  it("keeps migration robust for malformed v1 game collections and backfills valid seed ids", async () => {
    const { useLibrary } = await import("./library");
    persist("games-gallery:v1", { games: { nope: true } }, 1);
    await useLibrary.persist.rehydrate();
    expect(useLibrary.getState().games.length).toBeGreaterThan(0);
    expect(typeof useLibrary.getState().patchGame).toBe("function");

    const seed = useLibrary.getState().games.find((g) => g.steamAppId);
    expect(seed).toBeDefined();
    persist("games-gallery:v1", { games: [{ ...seed, steamAppId: undefined }] }, 1);
    await useLibrary.persist.rehydrate();
    expect(useLibrary.getState().games[0]?.steamAppId).toBe(seed?.steamAppId);
  });

  it("drops malformed rating entries and preserves refresh action", async () => {
    const { useRatings } = await import("./ratings");
    persist("games-gallery:ratings:v1", { entries: { demo: { fetchedAt: Date.now(), scores: null, errors: [] } }, refresh: null }, 1);
    await useRatings.persist.rehydrate();
    expect(useRatings.getState().entries).toEqual({});
    expect(typeof useRatings.getState().refresh).toBe("function");
  });

  it("drops future-dated rating cache and keeps a valid score entry", async () => {
    const { useRatings } = await import("./ratings");
    const valid = { fetchedAt: Date.now(), scores: [{ source: "steam", label: "Steam", score: 90 }], errors: [] };
    persist("games-gallery:ratings:v1", { entries: { future: { ...valid, fetchedAt: Number.MAX_SAFE_INTEGER }, good: valid } }, 1);
    await useRatings.persist.rehydrate();
    expect(Object.keys(useRatings.getState().entries)).toEqual(["good"]);
    expect(useRatings.getState().entries["good"]?.scores[0]?.score).toBe(90);
  });

  it("stores special game ids as own keys before caching and after rating refresh", async () => {
    vi.doMock("../platform/ratingsApi", () => ({
      fetchPublicRatings: vi.fn(async () => ({ fetchedAt: Date.now(), scores: [], errors: [] })),
    }));
    const { useRatings } = await import("./ratings");
    const { ratingEntry, ratingIsLoading } = await import("./ratings");
    for (const id of ["__proto__", "constructor", "toString"]) {
      expect(ratingEntry(useRatings.getState().entries, id)).toBeUndefined();
      expect(ratingIsLoading(useRatings.getState().loading, id)).toBe(false);
      await useRatings.getState().refresh({
        id, title: "Game", platformId: "pc", providerId: "steam", status: "backlog", owned: true, installed: false,
        year: 2024, genres: [], playtimeH: 0,
      }, true);
      expect(Object.hasOwn(useRatings.getState().entries, id)).toBe(true);
    }
    const roundTrip = JSON.parse(JSON.stringify(useRatings.getState().entries)) as Record<string, unknown>;
    for (const id of ["__proto__", "constructor", "toString"]) expect(Object.hasOwn(roundTrip, id)).toBe(true);
  });

  it.each([null, {}, [null]])("drops malformed Epic cache items (%j) and preserves refresh action", async (items) => {
    const { useFreebies } = await import("./freebies");
    persist("games-gallery:freebies:v1", { epic: { fetchedAt: Date.now(), items }, refreshEpic: null }, 1);
    await useFreebies.persist.rehydrate();
    expect(useFreebies.getState().epic).toBeUndefined();
    expect(useFreebies.getState().loading).toEqual({ epic: false, ps: false });
    expect(typeof useFreebies.getState().refreshEpic).toBe("function");
  });

  it("rejects future cache timestamps but retains valid cache data", async () => {
    const { useFreebies } = await import("./freebies");
    const epic = { fetchedAt: Date.now(), items: [{ id: "epic:1", store: "epic", title: "Free Game", url: "https://store.epicgames.com/p/free-game", status: "upcoming" }] };
    const ps = { fetchedAt: Date.now(), month: { month: "October", postUrl: "https://blog.playstation.com/month", publishedAt: "", games: ["Game"] } };
    persist("games-gallery:freebies:v1", { epic, ps }, 1);
    await useFreebies.persist.rehydrate();
    expect(useFreebies.getState().epic?.items).toHaveLength(1);
    expect(useFreebies.getState().ps?.month?.games).toEqual(["Game"]);

    persist("games-gallery:freebies:v1", {
      epic: { ...epic, fetchedAt: Number.MAX_SAFE_INTEGER },
      ps: { ...ps, fetchedAt: Number.MAX_SAFE_INTEGER },
    }, 1);
    await useFreebies.persist.rehydrate();
    expect(useFreebies.getState().epic).toBeUndefined();
    expect(useFreebies.getState().ps).toBeUndefined();
  });

  it("drops Epic offers with malformed optional dates but allows missing dates", async () => {
    const { useFreebies } = await import("./freebies");
    const base = { id: "epic:1", store: "epic", title: "Free Game", url: "https://store.epicgames.com/p/free-game", status: "upcoming" };
    persist("games-gallery:freebies:v1", { epic: { fetchedAt: Date.now(), items: [{ ...base, startsAt: "not-a-date" }] } }, 1);
    await useFreebies.persist.rehydrate();
    expect(useFreebies.getState().epic).toBeUndefined();

    persist("games-gallery:freebies:v1", { epic: { fetchedAt: Date.now(), items: [base] } }, 1);
    await useFreebies.persist.rehydrate();
    expect(useFreebies.getState().epic?.items[0]?.startsAt).toBeUndefined();
  });
});
