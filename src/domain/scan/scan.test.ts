import { describe, expect, it } from "vitest";
import { emulatorUsage } from "../emulatorUsage";
import { planLaunch } from "../launch";
import type { Game } from "../types";
import { classifyRom, cleanTitle, scanRoms } from "./classify";
import { applyImport, planRomImport, planSteamImport } from "./plan";
import { isManifestPath, parseAppManifest } from "./steam";

const game = (over: Partial<Game>): Game => ({
  id: "g", title: "Game", platformId: "ps2", providerId: "roms", year: 2000, genres: [],
  status: "backlog", owned: true, installed: false, playtimeH: 0, ...over,
});

describe("cleanTitle", () => {
  it("drops region, dump and disc tags", () => {
    expect(cleanTitle("Final Fantasy VII (USA) (Disc 1) [!]")).toBe("Final Fantasy VII");
    expect(cleanTitle("Sonic_the_Hedgehog (World)")).toBe("Sonic the Hedgehog");
  });
});

describe("classifyRom", () => {
  it("trusts unique extensions without a platform folder", () => {
    expect(classifyRom("dump/Zelda (USA).sfc")).toMatchObject({ rom: { platformId: "snes", title: "Zelda" } });
  });
  it("skips ambiguous containers with no folder hint", () => {
    expect(classifyRom("dump/Game.iso")).toEqual({ skip: "ambiguous" });
  });
  it("resolves ambiguous containers by the closest platform folder", () => {
    expect(classifyRom("roms/psx/Final Fantasy VII/disc.chd")).toMatchObject({ rom: { platformId: "ps1" } });
    expect(classifyRom("roms/Sony - PlayStation 2/Okami.iso")).toMatchObject({ rom: { platformId: "ps2" } });
    expect(classifyRom("ps2/psx/x.iso")).toMatchObject({ rom: { platformId: "ps1" } });
  });
  it("needs a folder for extensions that several systems share", () => {
    expect(classifyRom("roms/misc/game.cso")).toEqual({ skip: "ambiguous" });
    expect(classifyRom("roms/gc/Game.gcz")).toMatchObject({ rom: { platformId: "gc" } });
    expect(classifyRom("roms/wii/Game.gcz")).toMatchObject({ rom: { platformId: "wii" } });
  });
  it("does not mistake a markdown file for a Mega Drive ROM", () => {
    expect(classifyRom("roms/README.md")).toBeNull();
    expect(classifyRom("roms/megadrive/readme.md")).toBeNull();
    expect(classifyRom("roms/misc/Sonic.md")).toEqual({ skip: "ambiguous" });
    expect(classifyRom("roms/genesis/Sonic (USA).md")).toMatchObject({ rom: { platformId: "genesis" } });
  });
  it("ignores files that are not ROMs", () => {
    expect(classifyRom("roms/psx/readme.txt")).toBeNull();
    expect(classifyRom("roms/psx/noext")).toBeNull();
  });
  it("drops .bin tracks that belong to a cue sheet", () => {
    expect(classifyRom("roms/psx/A.bin", ["A.cue", "A.bin"])).toEqual({ skip: "companion" });
  });
});

describe("scanRoms", () => {
  it("collapses multi-disc dumps into one game and reports skips", () => {
    const { roms, skipped } = scanRoms([
      "r/psx/FF7 (Disc 1).cue", "r/psx/FF7 (Disc 1).bin", "r/psx/FF7 (Disc 2).cue",
      "r/unknown/mystery.iso", "r/gba/Metroid Fusion (USA).gba",
    ]);
    expect(roms.map((r) => `${r.platformId}:${r.title}`).sort()).toEqual(["gba:Metroid Fusion", "ps1:FF7"]);
    expect(skipped).toEqual([{ path: "r/psx/FF7 (Disc 1).bin", reason: "companion" }, { path: "r/unknown/mystery.iso", reason: "ambiguous" }]);
  });
});

describe("planRomImport", () => {
  const abs = (rel: string) => `D:/${rel}`;
  const roms = [
    { path: "r/ps2/Okami.iso", platformId: "ps2", title: "Okami", baseName: "Okami" },
    { path: "r/gba/Metroid Fusion (USA).gba", platformId: "gba", title: "Metroid Fusion", baseName: "Metroid Fusion (USA)" },
  ];

  it("links an existing game (accent/case-insensitive) instead of duplicating it", () => {
    const [item] = planRomImport([roms[0]!], [game({ id: "okami", title: "Ókami" })], abs);
    expect(item).toMatchObject({ kind: "link", gameId: "okami", patch: { romPath: "D:/r/ps2/Okami.iso", installed: true } });
  });
  it("reports already-imported games as same", () => {
    const g = game({ id: "okami", title: "Okami", romPath: "D:/r/ps2/Okami.iso", installed: true });
    expect(planRomImport([roms[0]!], [g], abs)[0]?.kind).toBe("same");
  });
  it("creates a new owned+installed game with the platform default emulator", () => {
    const item = planRomImport([roms[1]!], [], abs)[0]!;
    expect(item).toMatchObject({ kind: "new", emulatorId: "mgba", game: { providerId: "roms", owned: true, installed: true } });
    expect(item.game?.coverUrl).toContain("Nintendo%20-%20Game%20Boy%20Advance/Named_Boxarts/Metroid%20Fusion%20(USA).png");
  });
  it("gives no cover guess for names without a region tag", () => {
    expect(planRomImport([roms[0]!], [], abs)[0]?.game?.coverUrl).toBeUndefined();
  });
  it("keeps ids unique when the slug already exists", () => {
    const items = planRomImport([roms[0]!], [game({ id: "scan-ps2-okami", title: "Other" })], abs);
    expect(items[0]?.game?.id).toBe("scan-ps2-okami-2");
  });
  it("produces a path that the launch guard refuses when a folder name starts with a dash", () => {
    const item = planRomImport([{ ...roms[0]!, path: "-evil/ps2/Okami.iso" }], [], (r) => r)[0]!;
    const plan = planLaunch(item.game!, { installed: { pcsx2: true } });
    expect(plan.kind).toBe("blocked");
  });
});

describe("Steam manifests", () => {
  const acf = `"AppState"\n{\n\t"appid"\t\t"1245620"\n\t"name"\t\t"ELDEN RING"\n\t"SizeOnDisk"\t\t"53687091200"\n}`;

  it("parses appid, name and size", () => {
    expect(parseAppManifest(acf)).toEqual({ appId: 1245620, name: "ELDEN RING", sizeGb: 50 });
  });
  it("rejects manifests without a valid appid or name", () => {
    expect(parseAppManifest('"AppState" { "appid" "abc" "name" "X" }')).toBeNull();
    expect(parseAppManifest('"AppState" { "appid" "5" }')).toBeNull();
  });
  it("matches manifest files by name only", () => {
    expect(isManifestPath("lib/steamapps/appmanifest_12.acf")).toBe(true);
    expect(isManifestPath("lib/steamapps/appmanifest_12.acf.bak")).toBe(false);
  });
  it("links an owned Steam game and creates unknown ones as installed", () => {
    const owned = game({ id: "er", platformId: "pc", providerId: "steam", storeId: "1245620", title: "Elden Ring" });
    const items = planSteamImport([{ appId: 1245620, name: "ELDEN RING", sizeGb: 50 }, { appId: 7, name: "Tiny Game" }], [owned]);
    expect(items[0]).toMatchObject({ kind: "link", gameId: "er", patch: { installed: true, sizeGb: 50 } });
    expect(items[1]?.game).toMatchObject({ storeId: "7", steamAppId: 7, providerId: "steam", installed: true });
  });
});

describe("applyImport", () => {
  it("adds new games, patches links and never duplicates an id", () => {
    const base = [game({ id: "a", title: "A" })];
    const items = [
      { key: "1", kind: "link" as const, title: "A", platformId: "ps2", gameId: "a", patch: { installed: true } },
      { key: "2", kind: "new" as const, title: "B", platformId: "ps2", game: game({ id: "b", title: "B" }) },
      { key: "3", kind: "new" as const, title: "A2", platformId: "ps2", game: game({ id: "a", title: "A2" }) },
    ];
    const out = applyImport(base, items);
    expect(out.map((g) => g.id)).toEqual(["b", "a"]);
    expect(out.find((g) => g.id === "a")?.installed).toBe(true);
  });
});

describe("emulatorUsage", () => {
  it("groups console games by resolved emulator and counts the launchable ones", () => {
    const u = emulatorUsage([
      game({ id: "1", platformId: "ps2", romPath: "/x.iso", installed: true }),
      game({ id: "2", platformId: "ps2" }),
      game({ id: "3", platformId: "ps2", emulatorId: "retroarch" }),
      game({ id: "4", platformId: "pc" }),
      game({ id: "5", platformId: "ps5" }),
    ]);
    expect(u["pcsx2"]).toMatchObject({ ready: 1 });
    expect(u["pcsx2"]?.games).toHaveLength(2);
    expect(u["retroarch"]?.games).toHaveLength(1);
    expect(Object.keys(u).sort()).toEqual(["pcsx2", "retroarch"]);
  });
});

describe("review regressions", () => {
  const abs = (rel: string) => `D:/${rel}`;

  it("keeps non-Latin titles distinct instead of folding them to an empty key", () => {
    const { roms } = scanRoms(["r/psx/ドラゴンクエスト.cue", "r/psx/ファイナルファンタジー.cue"]);
    expect(roms).toHaveLength(2);
    const items = planRomImport(roms, [], abs);
    expect(new Set(items.map((i) => i.key)).size).toBe(2);
    expect(new Set(items.map((i) => i.game?.id)).size).toBe(2);
    const linked = planRomImport([roms[1]!], [game({ id: "dq", platformId: "ps1", title: "ドラゴンクエスト" })], abs);
    expect(linked[0]?.kind).toBe("new");
  });

  it("collapses titles that differ only by accents or punctuation", () => {
    const { roms } = scanRoms(["r/gb/Pokémon Red.gb", "r/gb/Pokemon Red.gb", "r/nes/Mega-Man 2.nes", "r/nes/Mega Man 2.nes"]);
    expect(roms).toHaveLength(2);
  });

  it("imports a Steam app once even when two libraries hold it, and skips tools", () => {
    const items = planSteamImport(
      [
        { appId: 5, name: "Same Game" }, { appId: 5, name: "Same Game" },
        { appId: 228980, name: "Steamworks Common Redistributables" },
        { appId: 1493710, name: "Proton Experimental" },
        { appId: 1628350, name: "Steam Linux Runtime 3.0 (sniper)" },
      ],
      [],
    );
    expect(items.map((i) => i.key)).toEqual(["steam:5"]);
  });

  it("turns a wishlist game into an owned, installed backlog game when disk evidence appears", () => {
    const wish = game({ id: "w", platformId: "pc", providerId: "steam", storeId: "9", status: "wishlist", owned: false });
    const steam = planSteamImport([{ appId: 9, name: "W" }], [wish])[0]!;
    expect(steam.patch).toMatchObject({ owned: true, installed: true, status: "backlog" });
    const rom = planRomImport([{ path: "r/ps2/W.iso", platformId: "ps2", title: "W", baseName: "W" }], [game({ id: "x", title: "W", status: "wishlist", owned: false })], abs)[0]!;
    expect(rom.patch).toMatchObject({ owned: true, installed: true, status: "backlog" });
  });
});
