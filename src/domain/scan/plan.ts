import { defaultEmulator } from "../emulators";
import { resolveEmulator } from "../launch";
import type { Game } from "../types";
import type { FoundRom } from "./classify";
import { fold, slug } from "./fold";
import { LIBRETRO_SYSTEM } from "./platformMap";
import { type SteamManifest, isSteamTool } from "./steam";

/** `new` adds a game, `link` updates one already in the library, `same` is already up to date. */
export interface ImportItem {
  key: string;
  kind: "new" | "link" | "same";
  title: string;
  platformId: string;
  /** Present for `new`. */
  game?: Game;
  /** Present for `link`. */
  gameId?: string;
  patch?: Partial<Game>;
  romPath?: string;
  /** Emulator that will run it (existing choice or the platform default). */
  emulatorId?: string;
}

/** Evidence on disk proves ownership: a wishlist entry becomes a backlog game. */
const ownedPatch = (g: Game): Partial<Game> => ({ owned: true, installed: true, ...(g.status === "wishlist" ? { status: "backlog" as const } : {}) });

/** libretro replaces these characters in thumbnail file names. */
const libretroName = (base: string) => `${base.replace(/[&*/:`<>?\\|]/g, "_")}.png`;

function coverFor(rom: FoundRom): string | undefined {
  const system = LIBRETRO_SYSTEM[rom.platformId];
  // Only No-Intro style names (with a region tag) have a chance to exist upstream.
  if (!system || !rom.baseName.includes("(")) return undefined;
  return `https://thumbnails.libretro.com/${encodeURIComponent(system)}/Named_Boxarts/${encodeURIComponent(libretroName(rom.baseName))}`;
}

const uniqueId = (base: string, taken: Set<string>) => {
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
};

/** `pathOf` turns a scan-relative path into the path stored on the game (absolute in Tauri). */
export function planRomImport(roms: FoundRom[], games: Game[], pathOf: (rel: string) => string): ImportItem[] {
  const taken = new Set(games.map((g) => g.id));
  return roms.map((rom) => {
    const romPath = pathOf(rom.path);
    const key = `rom:${rom.platformId}:${fold(rom.title)}`;
    const hit = games.find((g) => g.platformId === rom.platformId && fold(g.title) === fold(rom.title));
    if (hit) {
      const same = hit.romPath === romPath && hit.owned && hit.installed;
      return {
        key, kind: same ? "same" : "link", title: hit.title, platformId: rom.platformId, romPath,
        gameId: hit.id, patch: { romPath, ...ownedPatch(hit) }, emulatorId: resolveEmulator(hit)?.id,
      } satisfies ImportItem;
    }
    const game: Game = {
      id: uniqueId(`scan-${rom.platformId}-${slug(rom.title)}`, taken),
      title: rom.title, platformId: rom.platformId, providerId: "roms", year: 0, genres: [],
      coverUrl: coverFor(rom), status: "backlog", owned: true, installed: true, playtimeH: 0, romPath,
    };
    return { key, kind: "new", title: rom.title, platformId: rom.platformId, game, romPath, emulatorId: defaultEmulator(rom.platformId)?.id } satisfies ImportItem;
  });
}

export function planSteamImport(manifests: SteamManifest[], games: Game[]): ImportItem[] {
  const taken = new Set(games.map((g) => g.id));
  // Two libraries (or a backup) can hold the same app; tools/runtimes are not games.
  const unique = [...new Map(manifests.filter((m) => !isSteamTool(m.name)).map((m) => [m.appId, m])).values()];
  return unique.map((m) => {
    const key = `steam:${m.appId}`;
    const hit = games.find((g) => g.providerId === "steam" && (g.storeId === String(m.appId) || g.steamAppId === m.appId));
    if (hit) {
      const same = hit.owned && hit.installed && (m.sizeGb === undefined || hit.sizeGb === m.sizeGb);
      return {
        key, kind: same ? "same" : "link", title: hit.title, platformId: "pc",
        gameId: hit.id, patch: { ...ownedPatch(hit), sizeGb: m.sizeGb ?? hit.sizeGb },
      } satisfies ImportItem;
    }
    const game: Game = {
      id: uniqueId(`steam-pc-${slug(m.name)}`, taken),
      title: m.name, platformId: "pc", providerId: "steam", storeId: String(m.appId), steamAppId: m.appId,
      year: 0, genres: [], status: "backlog", owned: true, installed: true, sizeGb: m.sizeGb, playtimeH: 0,
      coverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${m.appId}/library_600x900.jpg`,
    };
    return { key, kind: "new", title: m.name, platformId: "pc", game } satisfies ImportItem;
  });
}

/** Pure reducer used by the store: adds `new` games (skipping duplicate ids) and patches `link`s. */
export function applyImport(games: Game[], items: ImportItem[]): Game[] {
  const patches = new Map(items.filter((i) => i.kind === "link" && i.gameId).map((i) => [i.gameId as string, i.patch ?? {}]));
  const existing = new Set(games.map((g) => g.id));
  const added = items.flatMap((i) => (i.kind === "new" && i.game && !existing.has(i.game.id) ? [i.game] : []));
  return [...added, ...games.map((g) => (patches.has(g.id) ? { ...g, ...patches.get(g.id) } : g))];
}
