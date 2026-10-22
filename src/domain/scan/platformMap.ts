/** Extensions that identify one platform on their own. */
export const UNIQUE_EXT: Record<string, string> = {
  nes: "nes", fds: "nes", unf: "nes",
  sfc: "snes", smc: "snes", fig: "snes", swc: "snes",
  z64: "n64", n64: "n64", v64: "n64",
  gb: "gb", gbc: "gbc", gba: "gba",
  nds: "nds", dsi: "nds",
  "3ds": "3ds", cci: "3ds", cxi: "3ds", cia: "3ds",
  nsp: "switch", xci: "switch", nsz: "switch", xcz: "switch",
  wua: "wiiu", wud: "wiiu", wux: "wiiu",
  vpk: "vita", xiso: "xbox", xex: "x360",
  sms: "sms", gg: "gg", pce: "pce", sgx: "pce", a26: "atari2600",
  gdi: "dc", cdi: "dc",
};

/**
 * Shared by several platforms in the ES-DE system tables (or, like .md, by non-ROM files):
 * only accepted when a folder name tells the platform.
 */
export const AMBIGUOUS_EXT = new Set([
  "iso", "bin", "cue", "chd", "zip", "7z", "rvz", "pbp", "img", "m3u",
  "cso", "ciso", "wbfs", "gcz", "gcm", "md", "gen", "smd",
]);

const ALIASES: Record<string, string[]> = {
  nes: ["nes", "famicom", "nintendoentertainmentsystem"],
  snes: ["snes", "sfc", "superfamicom", "supernintendo", "supernintendoentertainmentsystem"],
  n64: ["n64", "nintendo64"],
  gb: ["gb", "gameboy"],
  gbc: ["gbc", "gameboycolor"],
  gba: ["gba", "gameboyadvance"],
  nds: ["nds", "ds", "nintendods"],
  "3ds": ["3ds", "n3ds", "nintendo3ds"],
  switch: ["switch", "nintendoswitch", "nsw"],
  wii: ["wii", "nintendowii"],
  wiiu: ["wiiu", "nintendowiiu"],
  gc: ["gc", "gamecube", "ngc", "nintendogamecube"],
  ps1: ["ps1", "psx", "psone", "playstation", "sonyplaystation"],
  ps2: ["ps2", "playstation2", "sonyplaystation2"],
  ps3: ["ps3", "playstation3", "sonyplaystation3"],
  ps4: ["ps4", "playstation4", "sonyplaystation4"],
  psp: ["psp", "playstationportable", "sonyplaystationportable"],
  vita: ["vita", "psvita", "playstationvita", "sonyplaystationvita"],
  xbox: ["xbox", "microsoftxbox"],
  x360: ["x360", "xbox360", "microsoftxbox360"],
  genesis: ["genesis", "megadrive", "md", "segagenesis", "segamegadrive"],
  sms: ["sms", "mastersystem", "segamastersystem"],
  gg: ["gg", "gamegear", "segagamegear"],
  saturn: ["saturn", "segasaturn"],
  dc: ["dc", "dreamcast", "segadreamcast"],
  pce: ["pce", "pcengine", "tg16", "turbografx16", "turbografx"],
  atari2600: ["atari2600", "a2600"],
  neogeo: ["neogeo"],
  arcade: ["arcade", "mame", "fbneo", "fba", "cps1", "cps2", "cps3"],
  dos: ["dos", "msdos", "scummvm"],
};

export const FOLDER_ALIAS: Record<string, string> = Object.fromEntries(
  Object.entries(ALIASES).flatMap(([platform, names]) => names.map((n) => [n, platform])),
);

/** Folder-name normalization shared by the alias table and the scanner. */
export const foldFolder = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** libretro-thumbnails system folders; only the ones whose covers were verified or well-known. */
export const LIBRETRO_SYSTEM: Record<string, string> = {
  nes: "Nintendo - Nintendo Entertainment System",
  snes: "Nintendo - Super Nintendo Entertainment System",
  n64: "Nintendo - Nintendo 64",
  gc: "Nintendo - GameCube",
  wii: "Nintendo - Wii",
  wiiu: "Nintendo - Wii U",
  gb: "Nintendo - Game Boy",
  gbc: "Nintendo - Game Boy Color",
  gba: "Nintendo - Game Boy Advance",
  nds: "Nintendo - Nintendo DS",
  "3ds": "Nintendo - Nintendo 3DS",
  genesis: "Sega - Mega Drive - Genesis",
  sms: "Sega - Master System - Mark III",
  gg: "Sega - Game Gear",
  dc: "Sega - Dreamcast",
  saturn: "Sega - Saturn",
  xbox: "Microsoft - Xbox",
  x360: "Microsoft - Xbox 360",
  ps1: "Sony - PlayStation",
  ps2: "Sony - PlayStation 2",
  ps3: "Sony - PlayStation 3",
  ps4: "Sony - PlayStation 4",
  psp: "Sony - PlayStation Portable",
  vita: "Sony - PlayStation Vita",
};
