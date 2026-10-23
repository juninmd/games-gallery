import { describe, expect, it } from "vitest";
import { buildPlaylists } from "./playlist";
import type { Game } from "./types";

const g = (over: Partial<Game>): Game => ({
  id: "x", title: "Game", platformId: "gba", providerId: "roms", year: 2000, genres: [],
  status: "backlog", owned: true, installed: true, playtimeH: 0, romPath: "D:/ROMs/gba/Game.gba", ...over,
});

describe("buildPlaylists", () => {
  it("matches the documented JSON layout (golden)", () => {
    const [file] = buildPlaylists([g({ title: "Metroid Fusion", romPath: "D:/ROMs/gba/Metroid Fusion (USA).gba" })]);
    expect(file?.name).toBe("Nintendo - Game Boy Advance.lpl");
    expect(JSON.parse(file!.text)).toEqual({
      version: "1.0",
      items: [{
        path: "D:\\ROMs\\gba\\Metroid Fusion (USA).gba",
        label: "Metroid Fusion",
        core_path: "DETECT",
        core_name: "DETECT",
        crc32: "DETECT",
        db_name: "Nintendo - Game Boy Advance.lpl",
      }],
    });
  });
  it("doubles backslashes in the serialized text, as the format requires", () => {
    expect(buildPlaylists([g({})])[0]?.text).toContain('"D:\\\\ROMs\\\\gba\\\\Game.gba"');
  });
  it("keeps posix paths untouched on posix", () => {
    const item = JSON.parse(buildPlaylists([g({ romPath: "/roms/gba/Game.gba" })], "posix")[0]!.text).items[0];
    expect(item.path).toBe("/roms/gba/Game.gba");
  });
  it("skips games that cannot be launched from a playlist", () => {
    const out = buildPlaylists([
      g({ id: "a", romPath: undefined }), g({ id: "b", romPath: "  " }), g({ id: "c", owned: false }),
      g({ id: "d", platformId: "pc" }), g({ id: "e", platformId: "neogeo" }),
    ]);
    expect(out).toEqual([]);
  });
  it("makes one sorted playlist per platform", () => {
    const out = buildPlaylists([
      g({ id: "1", title: "Zelda", platformId: "snes", romPath: "D:/z.sfc" }),
      g({ id: "2", title: "Mario", platformId: "snes", romPath: "D:/m.sfc" }),
      g({ id: "3", title: "Wario", platformId: "gba" }),
    ]);
    expect(out.map((f) => f.name)).toEqual(["Nintendo - Game Boy Advance.lpl", "Nintendo - Super Nintendo Entertainment System.lpl"]);
    expect(JSON.parse(out[1]!.text).items.map((i: { label: string }) => i.label)).toEqual(["Mario", "Zelda"]);
  });
  it("escapes quotes in titles through JSON", () => {
    const item = JSON.parse(buildPlaylists([g({ title: 'The "Best" Game' })])[0]!.text).items[0];
    expect(item.label).toBe('The "Best" Game');
  });
});
