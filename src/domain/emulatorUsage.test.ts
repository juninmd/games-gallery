import { describe, expect, it } from "vitest";
import { emulatorUsage } from "./emulatorUsage";
import { resolveEmulator } from "./launch";
import type { Game } from "./types";

const g = (over: Partial<Game> & Pick<Game, "id">): Game => ({
  title: over.id, providerId: "roms", platformId: "ps2", year: 2000, genres: [], status: "backlog", owned: true, installed: false, playtimeH: 0, ...over,
});

describe("emulatorUsage", () => {
  it("never counts PC games", () => {
    expect(emulatorUsage([g({ id: "pc1", platformId: "pc", providerId: "steam" })])).toEqual({});
  });

  it("groups games by the emulator they resolve to", () => {
    const a = g({ id: "a" });
    const b = g({ id: "b" });
    const id = resolveEmulator(a)?.id;
    expect(id).toBeTruthy();
    expect(emulatorUsage([a, b])[id!]?.games.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("counts as ready only owned, installed games with a non-blank ROM path", () => {
    const id = resolveEmulator(g({ id: "x" }))!.id;
    const usage = emulatorUsage([
      g({ id: "ok", installed: true, romPath: "C:/roms/a.iso" }),
      g({ id: "blank", installed: true, romPath: "   " }),
      g({ id: "notInstalled", romPath: "C:/roms/b.iso" }),
      g({ id: "wish", owned: false, installed: true, romPath: "C:/roms/c.iso" }),
    ])[id];
    expect(usage?.games).toHaveLength(4);
    expect(usage?.ready).toBe(1);
  });
});
