import { describe, expect, it } from "vitest";
import { game } from "./gameFactory";
import { buildPegasusMetadata } from "./pegasus";

const ctx = { installed: { duckstation: true }, exePaths: { duckstation: "C:/Emu/duckstation.exe" } };

describe("buildPegasusMetadata", () => {
  it("writes one collection per platform with a launch line and one game per ROM", () => {
    const { text, count } = buildPegasusMetadata([
      game("ps1", "roms", "FF7", 1997, "JRPG", { i: true, rom: "D:/ROMs/ps1/ff7.cue" }),
      game("ps1", "roms", "Crash", 1996, "Plataforma", { i: true, rom: "D:/ROMs/ps1/crash.cue" }),
      game("pc", "steam", "Hades", 2020, "x", { i: true, store: 1 }),
    ], ctx);
    expect(count).toBe(2);
    expect(text).toMatch(/^collection: .+\nshortname: ps1\nlaunch: "C:\/Emu\/duckstation\.exe" .*"\{file\.path\}"/);
    expect(text.indexOf("game: Crash")).toBeLessThan(text.indexOf("game: FF7"));
    expect(text).toContain("game: FF7\nfile: D:/ROMs/ps1/ff7.cue\nrelease: 1997\ngenre: JRPG");
  });

  it("keeps every value on one line and skips ROM paths that would break the file", () => {
    const evil = game("ps1", "roms", "Bad\ngame: Injected", 1, "x", { i: true, rom: "D:/a.cue" });
    const quoted = game("ps1", "roms", "Q", 1, "x", { i: true, rom: 'D:/"q".cue' });
    const { text, count } = buildPegasusMetadata([evil, quoted], { installed: {} });
    expect(count).toBe(1);
    expect(text).toContain("game: Bad game: Injected\n");
    expect(text).not.toMatch(/^game: Injected/m);
    expect(text).not.toContain("launch:");
  });

  it("is empty without ROMs", () => {
    expect(buildPegasusMetadata([], ctx)).toEqual({ text: "", count: 0 });
  });
});
