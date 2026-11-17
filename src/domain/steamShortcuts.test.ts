import { describe, expect, it } from "vitest";
import { game } from "./gameFactory";
import { shortcutEntries } from "./steamShortcuts";

const ctx = { installed: { duckstation: true }, exePaths: { duckstation: "C:/Emu/duckstation.exe" } };

describe("shortcutEntries", () => {
  it("exports only emulated games that launch with an emulator found on disk", () => {
    const ff7 = game("ps1", "roms", "FF7", 1997, "JRPG", { i: true, rom: "D:/ROMs/ps1/ff7.cue" });
    const pc = game("pc", "steam", "Hades", 2020, "x", { i: true, store: 1145360 });
    const noRom = game("ps1", "roms", "Sem ROM", 1997, "x", { i: true });
    const entries = shortcutEntries([ff7, pc, noRom], ctx);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ name: "FF7", exe: "C:/Emu/duckstation.exe" });
    expect(entries[0]?.args).toContain("D:/ROMs/ps1/ff7.cue");
  });

  it("skips emulators only known by name (not found on disk) and titles with quotes", () => {
    const g = game("ps1", "roms", "FF7", 1997, "JRPG", { i: true, rom: "D:/ROMs/ps1/ff7.cue" });
    expect(shortcutEntries([g], { installed: { duckstation: true } })).toEqual([]);
    expect(shortcutEntries([game("ps1", "roms", 'A "B"', 1, "x", { i: true, rom: "D:/r.cue" })], ctx)).toEqual([]);
  });
});
