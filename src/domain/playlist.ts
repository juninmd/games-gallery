import { LIBRETRO_SYSTEM } from "./scan/platformMap";
import type { Game } from "./types";

export interface PlaylistFile {
  /** Named after the libretro system so RetroArch picks thumbnails and icons (db_name). */
  name: string;
  text: string;
}

/** RetroArch on Windows/DOS needs backslashes; JSON.stringify doubles them as the format requires. */
const nativePath = (p: string, os: "windows" | "posix") => (os === "windows" ? p.replace(/\//g, "\\") : p);

/**
 * One RetroArch JSON playlist (.lpl) per platform with at least one launchable ROM.
 * Core and CRC are `DETECT`: RetroArch then asks for a core, and netplay is limited
 * until the content is hashed (documented in docs.libretro.com, "roms-playlists-thumbnails").
 */
export function buildPlaylists(games: Game[], os: "windows" | "posix" = "windows"): PlaylistFile[] {
  const byPlatform = new Map<string, Game[]>();
  for (const g of games) {
    if (g.platformId === "pc" || !g.owned || !g.romPath?.trim() || !LIBRETRO_SYSTEM[g.platformId]) continue;
    byPlatform.set(g.platformId, [...(byPlatform.get(g.platformId) ?? []), g]);
  }
  return [...byPlatform].sort(([a], [b]) => a.localeCompare(b)).map(([platformId, list]) => {
    const dbName = `${LIBRETRO_SYSTEM[platformId]}.lpl`;
    const items = [...list]
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((g) => ({
        path: nativePath(g.romPath!.trim(), os),
        label: g.title,
        core_path: "DETECT",
        core_name: "DETECT",
        crc32: "DETECT",
        db_name: dbName,
      }));
    return { name: dbName, text: JSON.stringify({ version: "1.0", items }, null, 2) };
  });
}
