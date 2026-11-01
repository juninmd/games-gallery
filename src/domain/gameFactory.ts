import type { Game, PlayStatus } from "./types";

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

/** Builds a library entry from values the user typed; ids stay stable per provider/platform/title. */
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
