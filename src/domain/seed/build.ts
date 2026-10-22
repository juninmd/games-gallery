import type { Game, PlayStatus } from "../types";

export const ROMS_DIR = "D:/ROMs";

export const steamCover = (appId: number) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;

export const libretroCover = (system: string, file: string) =>
  `https://thumbnails.libretro.com/${encodeURIComponent(system)}/Named_Boxarts/${encodeURIComponent(file)}`;

export interface Opts {
  s?: PlayStatus;
  /** installed */
  i?: boolean;
  /** hours played */
  h?: number;
  /** rating 1-5 */
  r?: number;
  /** size in GB */
  gb?: number;
  cover?: string;
  emu?: string;
  steamAppId?: number;
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function game(
  platformId: string,
  providerId: string,
  title: string,
  year: number,
  genres: string,
  o: Opts & { store?: string | number; rom?: string } = {},
): Game {
  const status = o.s ?? "backlog";
  const owned = status !== "wishlist";
  return {
    id: slug(`${providerId}-${platformId}-${title}`),
    title,
    platformId,
    providerId,
    storeId: o.store !== undefined ? String(o.store) : undefined,
    steamAppId: o.steamAppId,
    year,
    genres: genres.split(",").map((x) => x.trim()),
    coverUrl: o.cover,
    status,
    owned,
    installed: owned && !!o.i,
    sizeGb: o.gb,
    playtimeH: o.h ?? 0,
    rating: o.r,
    romPath: o.rom,
    emulatorId: o.emu,
  };
}

/** PC game from a store; Steam art is reused for other stores' copies of the same title. */
export function pc(
  providerId: string,
  appId: number,
  title: string,
  year: number,
  genres: string,
  o: Opts = {},
): Game {
  const store = providerId === "steam" ? appId : `demo-${slug(title)}`;
  return game("pc", providerId, title, year, genres, { ...o, store, cover: steamCover(appId), steamAppId: appId });
}

/** Emulated title: `file` is the exact libretro thumbnail name (also used for the demo ROM path). */
export function rom(
  platformId: string,
  system: string,
  file: string,
  title: string,
  year: number,
  genres: string,
  o: Opts & { provider?: string } = {},
): Game {
  const base = file.replace(/\.png$/, "");
  return game(platformId, o.provider ?? "roms", title, year, genres, {
    ...o,
    cover: libretroCover(system, file),
    rom: `${ROMS_DIR}/${platformId}/${base}.zip`,
  });
}
