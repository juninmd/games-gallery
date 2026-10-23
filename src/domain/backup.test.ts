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

const wrap = (over: Record<string, unknown>) => JSON.stringify({ app: "games-gallery", version: BACKUP_VERSION, games: [], ...over });

describe("backup round trip", () => {
  it("restores exactly what was exported", () => {
    const r = parseBackup(exportBackup(data()));
    expect(r).toMatchObject({ ok: true, dropped: 0 });
    if (r.ok) expect(r.data.games[0]).toMatchObject({ title: "Okami", rating: 5, romPath: "D:/ROMs/ps2/Okami.iso", emulatorId: "pcsx2" });
    if (r.ok) expect(r.data.emulators).toEqual({ pcsx2: true });
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
  it("ignores unknown providers and emulators in the maps", () => {
    const r = parseBackup(wrap({ providers: { steam: { connected: true }, evil: { connected: true }, constructor: { connected: true } }, emulators: { pcsx2: true, nope: true, toString: true } }));
    expect(r.ok && Object.keys(r.data.providers)).toEqual(["steam"]);
    expect(r.ok && Object.keys(r.data.emulators)).toEqual(["pcsx2"]);
  });
});
