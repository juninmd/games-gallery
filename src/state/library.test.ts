import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { game } from "../domain/gameFactory";
import { useTasks } from "./tasks";

let useLibrary: typeof import("./library").useLibrary;

beforeAll(async () => {
  const storage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
  ({ useLibrary } = await import("./library"));
});

afterAll(() => vi.unstubAllGlobals());

afterEach(() => {
  useTasks.getState().cancelAll();
  useLibrary.getState().reset();
});

const library = () => useLibrary.getState();

describe("library starts empty and real", () => {
  it("has no demo games, providers or installed emulators", () => {
    expect(library().games).toEqual([]);
    expect(library().providers).toEqual({});
    expect(library().emulators).toEqual({});
    expect(library().settings).toEqual({ romsDir: "", emulatorsDir: "" });
  });

  it("does not invent data when detection runs outside the installed app", async () => {
    await library().detect();
    expect(library().games).toEqual([]);
    expect(library().providers).toEqual({});
  });
});

describe("restore and reset", () => {
  it("restores an explicitly empty setting while preserving missing setting keys", () => {
    const before = { ...library().settings };
    library().restore({ games: [], scans: [], settings: { romsDir: "" } });
    expect(library().settings).toEqual({ ...before, romsDir: "" });
  });

  it("reset clears games, providers and jobs", () => {
    library().addGame(game("pc", "steam", "Hades", 2020, "Roguelike", { i: true, store: 1145360 }));
    useTasks.getState().start("emu:retroarch", "Instalando");
    library().reset();
    expect(library().games).toEqual([]);
    expect(useTasks.getState().tasks).toEqual({});
  });
});

describe("install / uninstall follow the real target", () => {
  it("marks an emulated game as ready only when a ROM path exists", async () => {
    const noRom = game("ps1", "roms", "Sem ROM", 1997, "JRPG", { i: false });
    library().addGame(noRom);
    await library().installGame(noRom.id);
    expect(library().games.find((g) => g.id === noRom.id)?.installed).toBe(false);

    const withRom = game("ps1", "roms", "Com ROM", 1997, "JRPG", { i: false, rom: "D:/ROMs/ps1/game.zip" });
    library().addGame(withRom);
    await library().installGame(withRom.id);
    expect(library().games.find((g) => g.id === withRom.id)?.installed).toBe(true);
  });

  it("does not flip a PC game to installed without a store install", async () => {
    const g = game("pc", "steam", "Sem ID", 2020, "x", { i: false });
    library().addGame(g);
    await library().installGame(g.id);
    expect(library().games.find((x) => x.id === g.id)?.installed).toBe(false);
  });

  it("uninstalling an emulated game only clears the installed flag", async () => {
    const g = game("ps1", "roms", "A", 1997, "x", { i: true, rom: "D:/ROMs/ps1/a.zip" });
    library().addGame(g);
    await library().uninstallGame(g.id);
    expect(library().games.find((x) => x.id === g.id)?.installed).toBe(false);
    expect(library().games.find((x) => x.id === g.id)?.romPath).toBe("D:/ROMs/ps1/a.zip");
  });

  it("removing a game keeps the rest of the library", () => {
    const a = game("pc", "steam", "A", 2020, "x", {});
    const b = game("pc", "steam", "B", 2021, "x", {});
    library().addGame(a);
    library().addGame(b);
    library().removeGame(a.id);
    expect(library().games.map((g) => g.id)).toEqual([b.id]);
  });
});
