import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { game } from "../domain/gameFactory";

let dat: typeof import("./dat");
let useLibrary: typeof import("./library").useLibrary;

beforeAll(async () => {
  const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
  dat = await import("./dat");
  ({ useLibrary } = await import("./library"));
});

afterAll(() => vi.unstubAllGlobals());

const DAT = '<datafile><game name="Chrono Trigger (USA)"><rom name="c.sfc" crc="2D206BF7"/></game></datafile>';

describe("identifying ROMs against the user's DAT", () => {
  it("records the CRC for every hashed ROM, the DAT name only on a match, and skips compressed files", async () => {
    const roms = [
      { ...game("snes", "roms", "chrono", 1995, "RPG"), romPath: "D:/ROMs/snes/chrono.sfc" },
      { ...game("snes", "roms", "homebrew", 2020, "RPG"), romPath: "D:/ROMs/snes/homebrew.sfc" },
      { ...game("snes", "roms", "zipped", 1995, "RPG"), romPath: "D:/ROMs/snes/zipped.zip" },
      { ...game("snes", "roms", "broken", 1995, "RPG"), romPath: "D:/ROMs/snes/broken.sfc" },
    ];
    roms.forEach((g) => useLibrary.getState().addGame(g));
    expect(dat.useDat.getState().load(DAT, "snes.dat")).toBe(1);
    const hash = vi.fn(async (path: string) => {
      if (path.includes("broken")) throw new Error("ROM não encontrada");
      return path.includes("chrono") ? "2d206bf7" : "DEADBEEF";
    });
    expect(await dat.identifyRoms(hash)).toEqual({ matched: 1, hashed: 2, failed: 1 });
    const byId = (id: string) => useLibrary.getState().games.find((g) => g.id === id);
    expect(byId(roms[0]!.id)).toMatchObject({ romCrc32: "2D206BF7", datName: "Chrono Trigger (USA)" });
    expect(byId(roms[1]!.id)).toMatchObject({ romCrc32: "DEADBEEF", datName: undefined });
    expect(byId(roms[2]!.id)?.romCrc32).toBeUndefined();
    expect(hash).not.toHaveBeenCalledWith("D:/ROMs/snes/zipped.zip");
  });
  it("a new DAT matches already-hashed ROMs by lookup, without reading the files again", async () => {
    const g = { ...game("snes", "roms", "known", 1995, "RPG"), romPath: "D:/ROMs/snes/known.sfc", romCrc32: "CAFEBABE" };
    useLibrary.getState().addGame(g);
    dat.useDat.getState().load('<datafile><game name="Known (Japan)"><rom name="k.sfc" crc="cafebabe"/></game></datafile>', "jp.dat");
    const hash = vi.fn(async () => "00000000");
    await dat.identifyRoms(hash);
    expect(useLibrary.getState().games.find((x) => x.id === g.id)?.datName).toBe("Known (Japan)");
    expect(hash).not.toHaveBeenCalledWith("D:/ROMs/snes/known.sfc");
  });
  it("rejects a hash that is not 8 hex digits instead of storing it", async () => {
    const g = { ...game("gba", "roms", "odd", 2001, "RPG"), romPath: "D:/ROMs/gba/odd.gba" };
    useLibrary.getState().addGame(g);
    await expect(dat.identifyRom(g.id, async () => "nope")).rejects.toThrow("inválido");
    expect(useLibrary.getState().games.find((x) => x.id === g.id)?.romCrc32).toBeUndefined();
  });
});
