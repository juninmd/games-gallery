import { describe, expect, it } from "vitest";
import { defaultEmulator, emulatorsFor } from "./emulators";
import { planLaunch } from "./launch";
import { game } from "./seed/build";

const ctx = { installed: { duckstation: true, retroarch: true } };

describe("planLaunch", () => {
  it("builds a store URI for installed PC games", () => {
    const g = game("pc", "steam", "Hades", 2020, "Roguelike", { i: true, store: 1145360 });
    expect(planLaunch(g, ctx)).toMatchObject({ kind: "uri", uri: "steam://rungameid/1145360" });
  });

  it("refuses a store id that could smuggle URI parts", () => {
    const g = game("pc", "steam", "Evil", 2020, "x", { i: true, store: "1/../../x?cmd=1" });
    expect(planLaunch(g, ctx).kind).toBe("blocked");
  });

  it("passes the ROM as ONE argv element, even with spaces and shell metacharacters", () => {
    const rom = 'D:/ROMs/ps1/Final Fantasy VII & calc.exe "x".zip';
    const g = game("ps1", "roms", "FF7", 1997, "JRPG", { i: true, rom });
    const plan = planLaunch(g, ctx);
    expect(plan.kind).toBe("exec");
    if (plan.kind === "exec") {
      expect(plan.args).toContain(rom);
      expect(plan.args.filter((a) => a.includes("calc.exe"))).toHaveLength(1);
    }
  });

  it("blocks when the emulator is not installed", () => {
    const g = game("ps2", "roms", "GoW", 2005, "Ação", { i: true, rom: "D:/ROMs/ps2/gow.iso" });
    expect(planLaunch(g, ctx)).toMatchObject({ kind: "blocked", reason: expect.stringContaining("PCSX2") });
  });

  it("blocks wishlist and not-installed games before looking at emulators", () => {
    expect(planLaunch(game("ps1", "roms", "A", 1, "x", { s: "wishlist" }), ctx).kind).toBe("blocked");
    expect(planLaunch(game("ps1", "roms", "A", 1, "x", { rom: "r" }), ctx).kind).toBe("blocked");
  });

  it("resolves the RetroArch libretro core per platform", () => {
    const g = game("snes", "roms", "SMW", 1990, "x", { i: true, rom: "D:/ROMs/snes/smw.sfc", emu: "retroarch" });
    const plan = planLaunch(g, ctx);
    expect(plan).toMatchObject({ kind: "exec", exe: "retroarch.exe" });
    if (plan.kind === "exec") expect(plan.args).toContain("cores/snes9x_libretro.dll");
  });

  it("keeps `$` sequences in the ROM path literal", () => {
    const rom = "D:/ROMs/ps1/Jackpot $$$ $& $'.iso";
    const g = game("ps1", "roms", "A", 1, "x", { i: true, rom });
    const plan = planLaunch(g, ctx);
    expect(plan.kind === "exec" && plan.args.includes(rom)).toBe(true);
  });

  it("rejects a ROM path that would be parsed as an emulator option", () => {
    for (const rom of ["-batch", "  --config=x", "   "]) {
      const g = game("ps1", "roms", "A", 1, "x", { i: true, rom });
      expect(planLaunch(g, ctx).kind, rom).toBe("blocked");
    }
  });

  it("rejects ROM paths containing control characters", () => {
    const g = game("ps1", "roms", "A", 1, "x", { i: true, rom: "a\nb" });
    expect(planLaunch(g, ctx).kind).toBe("blocked");
  });
});

describe("emulator catalog", () => {
  it("prefers a dedicated emulator over RetroArch", () => {
    expect(defaultEmulator("ps1")?.id).toBe("duckstation");
    expect(emulatorsFor("ps1").at(-1)?.id).toBe("retroarch");
  });

  it("covers every past-gen platform and leaves only current-gen gaps", () => {
    for (const id of ["ps1", "ps2", "ps3", "ps4", "psp", "vita", "xbox", "x360", "gc", "wii", "wiiu", "switch", "3ds", "nds", "gba", "dc", "saturn", "n64", "snes", "nes", "genesis"]) {
      expect(emulatorsFor(id).length, id).toBeGreaterThan(0);
    }
    for (const id of ["ps5", "xone", "xsx"]) expect(emulatorsFor(id)).toHaveLength(0);
  });
});
