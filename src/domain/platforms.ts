import type { Platform } from "./types";

const p = (
  id: string,
  name: string,
  short: string,
  family: Platform["family"],
  year: number,
  color: string,
): Platform => ({ id, name, short, family, year, color });

export const PLATFORMS: Platform[] = [
  p("pc", "PC (Windows/Linux/macOS)", "PC", "pc", 1981, "#4c8dff"),
  p("ps1", "PlayStation", "PS1", "playstation", 1994, "#8a94b8"),
  p("ps2", "PlayStation 2", "PS2", "playstation", 2000, "#3a5bd9"),
  p("ps3", "PlayStation 3", "PS3", "playstation", 2006, "#5a5f73"),
  p("ps4", "PlayStation 4", "PS4", "playstation", 2013, "#2b6fdc"),
  p("ps5", "PlayStation 5", "PS5", "playstation", 2020, "#7fa8ff"),
  p("psp", "PlayStation Portable", "PSP", "playstation", 2004, "#6d7bb5"),
  p("vita", "PlayStation Vita", "Vita", "playstation", 2011, "#2d8fd5"),
  p("xbox", "Xbox", "Xbox", "xbox", 2001, "#3e9b3e"),
  p("x360", "Xbox 360", "360", "xbox", 2005, "#5cb85c"),
  p("xone", "Xbox One", "XOne", "xbox", 2013, "#2f8f4e"),
  p("xsx", "Xbox Series X|S", "XSX", "xbox", 2020, "#1fb86b"),
  p("nes", "Nintendo Entertainment System", "NES", "nintendo", 1983, "#c0392b"),
  p("snes", "Super Nintendo", "SNES", "nintendo", 1990, "#8e6bbf"),
  p("n64", "Nintendo 64", "N64", "nintendo", 1996, "#d9534f"),
  p("gc", "GameCube", "GC", "nintendo", 2001, "#6f5bd6"),
  p("wii", "Wii", "Wii", "nintendo", 2006, "#4ab3d8"),
  p("wiiu", "Wii U", "Wii U", "nintendo", 2012, "#2aa5c9"),
  p("switch", "Nintendo Switch", "NSW", "nintendo", 2017, "#e60012"),
  p("gb", "Game Boy", "GB", "nintendo", 1989, "#8a9a5b"),
  p("gbc", "Game Boy Color", "GBC", "nintendo", 1998, "#b05fd0"),
  p("gba", "Game Boy Advance", "GBA", "nintendo", 2001, "#5b4fcf"),
  p("nds", "Nintendo DS", "NDS", "nintendo", 2004, "#9aa3ad"),
  p("3ds", "Nintendo 3DS", "3DS", "nintendo", 2011, "#d6453d"),
  p("sms", "Master System", "SMS", "sega", 1985, "#c0392b"),
  p("genesis", "Mega Drive / Genesis", "MD", "sega", 1988, "#2c3e8f"),
  p("saturn", "Sega Saturn", "SAT", "sega", 1994, "#3d5a99"),
  p("dc", "Dreamcast", "DC", "sega", 1998, "#e67e22"),
  p("gg", "Game Gear", "GG", "sega", 1990, "#3b3b3b"),
  p("atari2600", "Atari 2600", "2600", "other", 1977, "#a0522d"),
  p("pce", "PC Engine / TurboGrafx-16", "PCE", "other", 1987, "#e08a1e"),
  p("neogeo", "Neo Geo", "NEO", "other", 1990, "#c9a227"),
  p("arcade", "Arcade (MAME)", "ARC", "other", 1971, "#d4478a"),
  p("dos", "MS-DOS / ScummVM", "DOS", "other", 1981, "#707070"),
];

export const PLATFORM_BY_ID: Record<string, Platform> = Object.fromEntries(
  PLATFORMS.map((x) => [x.id, x]),
);

export const FAMILY_LABEL: Record<Platform["family"], string> = {
  pc: "PC",
  playstation: "PlayStation",
  xbox: "Xbox",
  nintendo: "Nintendo",
  sega: "Sega",
  other: "Outros / Retrô",
};
