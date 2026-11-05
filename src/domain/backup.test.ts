import { describe, expect, it } from "vitest";
import { BACKUP_VERSION, MAX_BACKUP_BYTES, exportBackup, parseBackup, type BackupData } from "./backup";
import type { Game } from "./types";

const game = (over: Partial<Game> = {}): Game => ({
  id: "g1", title: "Okami", platformId: "ps2", providerId: "roms", year: 2006, genres: ["Aventura"],
  status: "backlog", owned: true, installed: true, playtimeH: 3, rating: 5, romPath: "D:/ROMs/ps2/Okami.iso",
  emulatorId: "pcsx2", ...over,
});

const data = (games: Game[] = [game()]): BackupData => ({
  games, scans: [], providers: { steam: { connected: true } }, emulators: { pcsx2: true },
  settings: { romsDir: "D:/ROMs", emulatorsDir: "D:/Emu" },
});

const wrap = (over: Record<string, unknown>) => JSON.stringify({ app: "games-gallery", version: BACKUP_VERSION, games: [game()], ...over });

describe("backup round trip", () => {
  it("restores exactly what was exported", () => {
    const r = parseBackup(exportBackup(data()));
    expect(r).toMatchObject({ ok: true, dropped: 0 });
    if (r.ok) expect(r.data.games[0]).toMatchObject({ title: "Okami", rating: 5, romPath: "D:/ROMs/ps2/Okami.iso", emulatorId: "pcsx2" });
    if (r.ok) expect(r.data.emulators).toEqual({ pcsx2: true });
  });
  it("round-trips an intentionally empty library", () => {
    const r = parseBackup(exportBackup(data([])));
    expect(r).toMatchObject({ ok: true, dropped: 0 });
    if (r.ok) expect(r.data.games).toEqual([]);
  });
  it("keeps backup import length and range limits separate from local storage", () => {
    const longPath = parseBackup(wrap({ games: [game({ romPath: "R".repeat(2001), playtimeH: 1_000_001 })], settings: { romsDir: "A".repeat(1001) } }));
    expect(longPath.ok && longPath.data.games[0]).toMatchObject({ romPath: undefined, playtimeH: 0 });
    expect(longPath.ok && longPath.data.settings).toEqual({});
    expect(parseBackup(wrap({ games: [game({ title: "T".repeat(301) })] })).ok).toBe(false);
  });
  it("never writes API keys or ratings cache", () => {
    const text = exportBackup({ ...data(), rawgKey: "SECRET", entries: {} } as BackupData);
    // Callers pass only library fields; extra ones would still be dropped on import.
    const r = parseBackup(text);
    expect(r.ok && Object.keys(r.data).sort()).toEqual(["emulators", "games", "providers", "scans", "settings"]);
  });
});

describe("parseBackup rejects untrusted input", () => {
  it.each([
    ["not json", "{oops"],
    ["wrong app", JSON.stringify({ app: "other", version: 1, games: [] })],
    ["array root", "[]"],
    ["missing games", JSON.stringify({ app: "games-gallery", version: 1 })],
    ["version 0", wrap({ version: 0 })],
    ["fractional version", wrap({ version: 1.5 })],
  ])("%s", (_n, text) => expect(parseBackup(text).ok).toBe(false));

  it("tells the user a newer backup needs a newer app", () => {
    const r = parseBackup(wrap({ version: BACKUP_VERSION + 1 }));
    expect(r.ok === false && r.error).toContain("atualize");
  });
  it("rejects oversized files before parsing", () => {
    expect(parseBackup(" ".repeat(MAX_BACKUP_BYTES + 1)).ok).toBe(false);
  });
});

describe("parseBackup sanitizes games", () => {
  const parse = (games: unknown[]) => parseBackup(wrap({ games }));

  it("drops invalid, duplicate and prototype-keyed entries and counts them", () => {
    const r = parse([
      game(), game(), game({ id: "x", platformId: "constructor" }), game({ id: "y", providerId: "__proto__" }),
      { ...game({ id: "z" }), status: "bogus" }, null, "str", { ...game({ id: "w" }), owned: "yes" },
    ]);
    expect(r.ok && r.data.games.map((g) => g.id)).toEqual(["g1"]);
    expect(r.ok && r.dropped).toBe(7);
  });
  it("strips unknown fields and unsafe values", () => {
    const r = parse([{ ...game(), evil: "x", __proto__: { polluted: true }, storeId: "a b;rm", coverUrl: "javascript:alert(1)", emulatorId: "constructor", rating: 99, playtimeH: -4, year: "2020" }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const g = r.data.games[0]!;
    expect(g).not.toHaveProperty("evil");
    expect(g).toMatchObject({ storeId: undefined, coverUrl: undefined, emulatorId: undefined, rating: undefined, playtimeH: 0, year: 0 });
  });
  it("keeps the wishlist invariant: not owned, not installed", () => {
    const r = parse([game({ status: "wishlist", owned: true, installed: true })]);
    expect(r.ok && r.data.games[0]).toMatchObject({ owned: false, installed: false });
  });
  it("derives owned from status so stats cannot see a completed game that is not owned", () => {
    const r = parse([game({ status: "completed", owned: false, installed: true })]);
    expect(r.ok && r.data.games[0]).toMatchObject({ owned: true, status: "completed" });
  });
  it("keeps current providers/emulators when the file does not carry them", () => {
    const r = parseBackup(wrap({}));
    expect(r.ok && r.data.providers).toBeUndefined();
    expect(r.ok && r.data.emulators).toBeUndefined();
  });
  it("preserves absent or invalid settings and keeps an explicit empty string", () => {
    const r = parseBackup(wrap({ settings: { romsDir: "", emulatorsDir: 7, unknown: "ignored" } }));
    expect(r.ok && r.data.settings).toEqual({ romsDir: "" });
  });
  it("rejects a nonempty backup whose games are all invalid", () => {
    expect(parseBackup(wrap({ games: [{ id: "x" }] })).ok).toBe(false);
  });
  it("deduplicates scan ids", () => {
    const scan = { id: "s1", kind: "roms", name: "n", at: "2026-01-01T00:00:00Z", added: 1, linked: 0 };
    const r = parseBackup(wrap({ scans: [scan, scan] }));
    expect(r.ok && r.data.scans).toHaveLength(1);
  });
  it("ignores unknown providers and emulators in the maps", () => {
    const r = parseBackup(wrap({ providers: { steam: { connected: true }, evil: { connected: true }, constructor: { connected: true } }, emulators: { pcsx2: true, nope: true, toString: true } }));
    expect(r.ok && Object.keys(r.data.providers ?? {})).toEqual(["steam"]);
    expect(r.ok && Object.keys(r.data.emulators ?? {})).toEqual(["pcsx2"]);
  });
});

describe("separate flag", () => {
  it("survives a backup round trip, and only the literal true counts", () => {
    const back = parseBackup(exportBackup(data([game({ separate: true }), game({ id: "g2", title: "Other" })])));
    expect(back.ok && back.data.games.map((g) => g.separate)).toEqual([true, undefined]);
    const tampered = JSON.parse(exportBackup(data([game({ separate: true })])));
    tampered.games[0].separate = "yes";
    const bad = parseBackup(JSON.stringify(tampered));
    expect(bad.ok && bad.data.games[0]!.separate).toBeUndefined();
  });
});

describe("tags, time to beat and queue in a backup", () => {
  it("round-trips them and sanitizes tampered values", () => {
    const back = parseBackup(exportBackup(data([game({ tags: ["Cozy"], hoursToBeat: 12, queuedAt: 1700000000000 })])));
    expect(back.ok && back.data.games[0]).toMatchObject({ tags: ["Cozy"], hoursToBeat: 12, queuedAt: 1700000000000 });
    const forged = parseBackup(wrap({ games: [{ ...game(), tags: ["ok", "ok", 3, "x".repeat(99)], hoursToBeat: -5, queuedAt: "now" }] }));
    expect(forged.ok && forged.data.games[0]).toMatchObject({ tags: ["ok", "x".repeat(30)], hoursToBeat: undefined, queuedAt: undefined });
  });
});

describe("saved views and play log in a backup", () => {
  const view = { id: "v1", name: "Cozy curtos", filter: { query: "", providerIds: ["steam"], platformId: null, status: null, installedOnly: true, ownedOnly: false, multiStoreOnly: false, tag: "cozy", sort: "title" } };
  it("round-trips both and sanitizes tampered entries", () => {
    const text = exportBackup({ ...data(), savedViews: [view as never], playLog: [{ d: 20000, title: "Okami", h: 2.5 }] });
    const ok = parseBackup(text);
    expect(ok.ok && ok.data.savedViews).toEqual([view]);
    expect(ok.ok && ok.data.playLog).toEqual([{ d: 20000, title: "Okami", h: 2.5 }]);
    const forged = JSON.parse(text);
    forged.savedViews = [{ id: "x", name: "ok", filter: { providerIds: ["constructor"], status: "bogus" } }, { id: "", name: "bad" }];
    forged.playLog = [{ d: -1, title: "x", h: 1 }, { d: 5, title: "y", h: 0 }, { d: 5, title: "z", h: 3 }];
    const r = parseBackup(JSON.stringify(forged));
    expect(r.ok && r.data.savedViews?.map((v) => [v.id, v.filter.providerIds, v.filter.status])).toEqual([["x", [], null]]);
    expect(r.ok && r.data.playLog).toEqual([{ d: 5, title: "z", h: 3 }]);
  });
  it("an older backup without them leaves the current ones alone", () => {
    const r = parseBackup(exportBackup(data()));
    expect(r.ok && r.data.savedViews).toBeUndefined();
    expect(r.ok && r.data.playLog).toBeUndefined();
  });
});

describe("price targets in a backup", () => {
  it("round-trips valid targets and drops malformed ones, including prototype keys", () => {
    const text = exportBackup({ ...data(), priceTargets: { hades: { cents: 4000, currency: "BRL", title: "Hades" } } });
    const ok = parseBackup(text);
    expect(ok.ok && ok.data.priceTargets).toEqual({ hades: { cents: 4000, currency: "BRL", title: "Hades" } });
    const forged = JSON.parse(text);
    forged.priceTargets = JSON.parse('{"__proto__": {"cents": 1, "currency": "BRL", "title": "x"}, "bad": {"cents": -3, "currency": "BRL", "title": "x"}, "good": {"cents": 7, "currency": "USD", "title": "Good"}}');
    const r = parseBackup(JSON.stringify(forged));
    expect(r.ok && Object.keys(r.data.priceTargets ?? {})).toEqual(["good"]);
  });
  it("an old backup without targets leaves the current ones alone (undefined, not empty)", () => {
    const r = parseBackup(exportBackup(data()));
    expect(r.ok && r.data.priceTargets).toBeUndefined();
  });
});
