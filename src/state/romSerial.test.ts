import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { game } from "../domain/gameFactory";

let mod: typeof import("./romSerial");
let useLibrary: typeof import("./library").useLibrary;

beforeAll(async () => {
  const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
  mod = await import("./romSerial");
  ({ useLibrary } = await import("./library"));
});

afterAll(() => vi.unstubAllGlobals());

describe("readRomSerials", () => {
  it("reads only GameCube/Wii/3DS ROMs without an ID, keeps valid IDs and survives failures", async () => {
    const gc = { ...game("gc", "roms", "Melee", 2001, "Luta"), romPath: "/roms/gc/Melee.iso" };
    const broken = { ...game("wii", "roms", "Galaxy", 2007, "Plataforma"), romPath: "/roms/wii/Galaxy.wbfs" };
    const junk = { ...game("3ds", "roms", "Land", 2011, "Plataforma"), romPath: "/roms/3ds/Land.3ds" };
    const known = { ...game("gc", "roms", "Pikmin", 2001, "Estratégia"), romPath: "/roms/gc/Pikmin.iso", romSerial: "GPIE01" };
    const ps2 = { ...game("ps2", "roms", "Okami", 2006, "Ação"), romPath: "/roms/ps2/Okami.iso" };
    const zipped = { ...game("gc", "roms", "Zip", 2001, "Ação"), romPath: "/roms/gc/Zip.zip" };
    [gc, broken, junk, known, ps2, zipped].forEach((g) => useLibrary.getState().addGame(g));

    const read = vi.fn(async (path: string) => {
      if (path.includes("Galaxy")) throw new Error("not found");
      if (path.includes("Land")) return "../etc"; // never trust what crosses the bridge
      return "GALE01";
    });
    expect(await mod.readRomSerials(read)).toBe(1);
    expect(read.mock.calls.map(([p]) => p).sort()).toEqual(["/roms/3ds/Land.3ds", "/roms/gc/Melee.iso", "/roms/wii/Galaxy.wbfs"]);
    const byId = (id: string) => useLibrary.getState().games.find((g) => g.id === id);
    expect(byId(gc.id)?.romSerial).toBe("GALE01");
    expect(byId(junk.id)?.romSerial).toBeUndefined();
    expect(byId(known.id)?.romSerial).toBe("GPIE01");

    // A second pass in the same session does not re-read files that had no ID.
    read.mockClear();
    await mod.readRomSerials(read);
    expect(read).not.toHaveBeenCalled();
  });
});
