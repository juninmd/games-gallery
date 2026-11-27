/**
 * GameTDB full cover scans (back | spine | front in one image) for GameCube, Wii and 3DS, keyed by
 * the ID read from the ROM header. Image host and region rules ported from iBox (MIT,
 * metadata/gametdb.rs). GameTDB images are free to use; credit shown in the drawer.
 */
export const GAMETDB_HOST = "https://art.gametdb.com";

/** GameCube/Wii IDs are 6 chars (GALE01), 3DS product codes 4 (AREE). */
export const ROM_SERIAL = /^[A-Z0-9]{4}(?:[A-Z0-9]{2})?$/;

const ROOT: Record<string, { dir: string; ext: string; idLength: number }> = {
  gc: { dir: "wii", ext: "png", idLength: 6 },
  wii: { dir: "wii", ext: "png", idLength: 6 },
  "3ds": { dir: "3ds", ext: "jpg", idLength: 4 },
};

export const hasGametdbScans = (platformId: string) => platformId in ROOT;

/** Scan regions for an ID, most likely first, from its 4th character (Nintendo region letter). */
export function scanRegions(serial: string): string[] {
  switch (serial[3]) {
    case "E": case "N": return ["US", "EN"];
    case "J": return ["JA"];
    case "K": return ["KO"];
    case "D": return ["DE", "EN"];
    case "F": return ["FR", "EN"];
    case "S": return ["ES", "EN"];
    case "I": return ["IT", "EN"];
    case "H": return ["NL", "EN"];
    case "P": case "U": case "X": case "Y": case "Z": return ["EN", "FR", "DE"];
    default: return ["US", "EN"];
  }
}

/** Candidate scan URLs, best first (HD before standard). Empty when the platform or ID does not fit. */
export function fullCoverUrls(platformId: string, serial: string | undefined): string[] {
  const root = ROOT[platformId];
  if (!root || !serial || serial.length !== root.idLength || !ROM_SERIAL.test(serial)) return [];
  return scanRegions(serial).flatMap((region) =>
    ["coverfullHQ", "coverfull"].map((kind) => `${GAMETDB_HOST}/${root.dir}/${kind}/${region}/${serial}.${root.ext}`),
  );
}
