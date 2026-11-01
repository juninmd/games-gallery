import { defaultEmulator } from "../emulators";
import { resolveEmulator } from "../launch";
import type { DetectedEntry, Game } from "../types";
import type { FoundRom } from "./classify";
import type { EpicInstallRecord } from "./epic";
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
  /** Visible review warning for a source-declared installation needing verification. */
  warning?: string;
}

/** Evidence on disk proves ownership: a wishlist entry becomes a backlog game. */
const ownedPatch = (g: Game, installed = true): Partial<Game> => ({ owned: true, ...(installed ? { installed: true } : {}), ...(g.status === "wishlist" ? { status: "backlog" as const } : {}) });

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
  const firstGameByTitle = new Map<string, Game>();
  for (const game of games) {
    const key = `${game.platformId}\u0000${fold(game.title)}`;
    if (!firstGameByTitle.has(key)) firstGameByTitle.set(key, game);
  }
  return roms.map((rom) => {
    const romPath = pathOf(rom.path);
    const key = `rom:${rom.platformId}:${fold(rom.title)}`;
    const hit = firstGameByTitle.get(`${rom.platformId}\u0000${fold(rom.title)}`);
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
      const installed = m.installed !== false;
      const same = hit.owned && (!installed || hit.installed) && (m.sizeGb === undefined || hit.sizeGb === m.sizeGb);
      return {
        key, kind: same ? "same" : "link", title: hit.title, platformId: "pc",
        gameId: hit.id, patch: { ...ownedPatch(hit, installed), sizeGb: m.sizeGb ?? hit.sizeGb },
      } satisfies ImportItem;
    }
    const game: Game = {
      id: uniqueId(`steam-pc-${slug(m.name)}`, taken),
      title: m.name, platformId: "pc", providerId: "steam", storeId: String(m.appId), steamAppId: m.appId,
      year: 0, genres: [], status: "backlog", owned: true, installed: m.installed !== false, sizeGb: m.sizeGb, playtimeH: 0,
      coverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${m.appId}/library_600x900.jpg`,
    };
    return { key, kind: "new", title: m.name, platformId: "pc", game } satisfies ImportItem;
  });
}

/** Matches Epic installs only within Epic PC games; store IDs are the primary identity. */export function planEpicImport(records: EpicInstallRecord[], games: Game[]): ImportItem[] {
  const taken = new Set(games.map((g) => g.id));
  const byStoreId = new Map<string, Game>();
  const byEpicTitleWithoutStoreId = new Map<string, Game>();
  for (const game of games) {
    if (game.platformId !== "pc" || game.providerId !== "epic") continue;
    if (game.storeId) {
      if (!byStoreId.has(game.storeId)) byStoreId.set(game.storeId, game);
    } else {
      const titleKey = fold(game.title);
      if (!byEpicTitleWithoutStoreId.has(titleKey)) byEpicTitleWithoutStoreId.set(titleKey, game);
    }
  }
  const seenAppNames = new Set<string>();
  const warning = "Legendary indica que esta instalação precisa de verificação.";
  const out: ImportItem[] = [];
  for (const record of records) {
    if (seenAppNames.has(record.appName)) continue;
    seenAppNames.add(record.appName);
    const hit = byStoreId.get(record.appName) ?? byEpicTitleWithoutStoreId.get(fold(record.title));
    const itemWarning = record.needsVerification ? warning : undefined;
    const key = `epic:${record.appName}`;
    if (hit) {
      const storeIdPatch = hit.storeId ? {} : { storeId: record.appName };
      const sizePatch = record.sizeGb === undefined ? {} : { sizeGb: record.sizeGb };
      const installed = record.installed !== false;
      const same = !!hit.storeId && hit.owned && (!installed || hit.installed) && (record.sizeGb === undefined || hit.sizeGb === record.sizeGb);
      out.push({
        key, kind: same ? "same" : "link", title: hit.title, platformId: "pc", gameId: hit.id,
        patch: { ...ownedPatch(hit, installed), ...storeIdPatch, ...sizePatch }, warning: itemWarning,
      });
      continue;
    }
    const game: Game = {
      id: uniqueId(`epic-pc-${slug(record.title)}`, taken),
      title: record.title, platformId: "pc", providerId: "epic", storeId: record.appName,
      year: 0, genres: [], status: "backlog", owned: true, installed: record.installed !== false, sizeGb: record.sizeGb, playtimeH: 0,
    };
    out.push({ key, kind: "new", title: record.title, platformId: "pc", game, warning: itemWarning });
  }
  return out;
}

/** Matches detected stores (GOG, itch, Amazon, Ubisoft, Rockstar…) by store id, then by title. */
export function planStoreImport(providerId: string, entries: DetectedEntry[], games: Game[]): ImportItem[] {
  const taken = new Set(games.map((g) => g.id));
  const byStoreId = new Map<string, Game>();
  const byTitle = new Map<string, Game>();
  for (const game of games) {
    if (game.providerId !== providerId) continue;
    if (game.storeId && !byStoreId.has(game.storeId)) byStoreId.set(game.storeId, game);
    const key = fold(game.title);
    if (!byTitle.has(key)) byTitle.set(key, game);
  }

  const out: ImportItem[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const title = entry.title.trim();
    if (!title || seen.has(entry.storeId)) continue;
    seen.add(entry.storeId);
    const hit = byStoreId.get(entry.storeId) ?? byTitle.get(fold(title));
    const size = entry.sizeGb === undefined ? {} : { sizeGb: entry.sizeGb };
    const playtime = entry.playtimeH === undefined ? {} : { playtimeH: entry.playtimeH };
    if (hit) {
      const same = hit.owned && hit.installed === entry.installed && (entry.sizeGb === undefined || hit.sizeGb === entry.sizeGb);
      out.push({
        key: `${providerId}:${entry.storeId}`,
        kind: same ? "same" : "link",
        title: hit.title,
        platformId: hit.platformId,
        gameId: hit.id,
        // A newly installed game adopts the local id: launch URIs need it, and an account id (space/offer uuid) may differ.
        patch: { owned: true, installed: entry.installed, ...(hit.storeId && !(entry.installed && !hit.installed) ? {} : { storeId: entry.storeId }), ...size, ...playtime },
      });
      continue;
    }
    out.push({
      key: `${providerId}:${entry.storeId}`,
      kind: "new",
      title,
      platformId: "pc",
      game: {
        id: uniqueId(`${providerId}-pc-${slug(title)}`, taken),
        title,
        platformId: "pc",
        providerId,
        storeId: entry.storeId,
        year: 0,
        genres: [],
        status: "backlog",
        owned: true,
        installed: entry.installed,
        playtimeH: entry.playtimeH ?? 0,
        ...size,
        coverUrl: providerId === "steam" ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${entry.storeId}/library_600x900.jpg` : undefined,
      },
    });
  }
  return out;
}

/** Pure reducer used by the store: adds `new` games (skipping duplicate ids) and patches `link`s. */
export function applyImport(games: Game[], items: ImportItem[]): Game[] {
  const patches = new Map(items.filter((i) => i.kind === "link" && i.gameId).map((i) => [i.gameId as string, i.patch ?? {}]));
  const existing = new Set(games.map((g) => g.id));
  const added = items.flatMap((i) => (i.kind === "new" && i.game && !existing.has(i.game.id) ? [i.game] : []));
  return [...added, ...games.map((g) => (patches.has(g.id) ? { ...g, ...patches.get(g.id) } : g))];
}
