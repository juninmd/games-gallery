import { MORE_EMULATORS } from "./emulatorsMore";
import { INSTALL_SOURCES } from "./emulatorSources";
import type { Emulator } from "./types";

const ALL_OS: Emulator["os"] = ["windows", "linux", "macos"];

// exe/args are per-emulator heuristics; each one must be validated against the
// installed build in the Tauri phase before enabling real execution.
const CORE: Emulator[] = [
  { id: "duckstation", name: "DuckStation", platforms: ["ps1"], os: ALL_OS, status: "active", homepage: "https://www.duckstation.org", exe: "duckstation-qt-x64-ReleaseLTCG.exe", args: ["-batch", "-fullscreen", "--", "{rom}"], needsBios: true, notes: "Exige BIOS do PS1 (dump do seu console)." },
  { id: "pcsx2", name: "PCSX2", platforms: ["ps2"], os: ALL_OS, status: "active", homepage: "https://pcsx2.net", exe: "pcsx2-qt.exe", args: ["-batch", "-fullscreen", "--", "{rom}"], needsBios: true, notes: "Exige BIOS do PS2." },
  { id: "rpcs3", name: "RPCS3", platforms: ["ps3"], os: ALL_OS, status: "active", homepage: "https://rpcs3.net", exe: "rpcs3.exe", args: ["--no-gui", "{rom}"], needsBios: false, notes: "Firmware do PS3 instalado pelo próprio emulador. Exige GPU Vulkan." },
  { id: "shadps4", name: "shadPS4", platforms: ["ps4"], os: ALL_OS, status: "experimental", homepage: "https://shadps4.net", exe: "shadPS4.exe", args: ["-g", "{rom}"], launchVerified: true, needsBios: false, notes: "Experimental: compatibilidade limitada, checar a lista de jogos." },
  { id: "ppsspp", name: "PPSSPP", platforms: ["psp"], os: ALL_OS, status: "active", homepage: "https://www.ppsspp.org", exe: "PPSSPPWindows64.exe", args: ["{rom}"], needsBios: false, notes: "Sem BIOS." },
  { id: "vita3k", name: "Vita3K", platforms: ["vita"], os: ALL_OS, status: "experimental", homepage: "https://vita3k.org", exe: "Vita3K.exe", args: ["-r", "{rom}"], needsBios: true, notes: "Usa o ID do título (ex.: PCSE00120) em vez do caminho; exige firmware do Vita." },
  { id: "xemu", name: "xemu", platforms: ["xbox"], os: ALL_OS, status: "active", homepage: "https://xemu.app", exe: "xemu.exe", args: ["-dvd_path", "{rom}"], needsBios: true, notes: "Exige BIOS, MCPX boot ROM e HDD image do Xbox original." },
  { id: "xenia", name: "Xenia Canary", platforms: ["x360"], os: ["windows"], status: "experimental", homepage: "https://github.com/xenia-canary/xenia-canary", exe: "xenia_canary.exe", args: ["{rom}"], needsBios: false, notes: "Só Windows; compatibilidade variável." },
  { id: "dolphin", name: "Dolphin", platforms: ["gc", "wii"], os: ALL_OS, status: "active", homepage: "https://dolphin-emu.org", exe: "Dolphin.exe", args: ["-b", "-e", "{rom}"], needsBios: false, notes: "Sem BIOS para a maioria dos jogos." },
  { id: "cemu", name: "Cemu", platforms: ["wiiu"], os: ALL_OS, status: "active", homepage: "https://cemu.info", exe: "Cemu.exe", args: ["-f", "-g", "{rom}"], needsBios: false, notes: "Requer chaves de decriptação do Wii U (online_files/keys.txt)." },
  { id: "ryubing", name: "Ryubing (fork do Ryujinx)", platforms: ["switch"], os: ALL_OS, status: "community-fork", exe: "Ryujinx.exe", args: ["{rom}"], needsBios: true, notes: "O Ryujinx original foi descontinuado; este é um fork mantido pela comunidade. Exige prod.keys e firmware do seu Switch." },
  { id: "eden", name: "Eden (fork do Yuzu)", platforms: ["switch"], os: ALL_OS, status: "community-fork", exe: "eden.exe", args: ["-g", "{rom}"], needsBios: true, notes: "O Yuzu original foi descontinuado; fork da comunidade. Exige prod.keys e firmware." },
  { id: "azahar", name: "Azahar", platforms: ["3ds"], os: ALL_OS, status: "community-fork", homepage: "https://azahar-emu.org", exe: "azahar.exe", args: ["{rom}"], needsBios: false, notes: "Sucessor comunitário do Citra (descontinuado)." },
  { id: "melonds", name: "melonDS", platforms: ["nds"], os: ALL_OS, status: "active", homepage: "https://melonds.kuribo64.net", exe: "melonDS.exe", args: ["{rom}"], needsBios: false, notes: "Roda sem BIOS (firmware livre), mas BIOS original melhora a precisão." },
  { id: "mgba", name: "mGBA", platforms: ["gba", "gb", "gbc"], os: ALL_OS, status: "active", homepage: "https://mgba.io", exe: "mGBA.exe", args: ["-f", "{rom}"], needsBios: false, notes: "Sem BIOS necessária." },
  { id: "flycast", name: "Flycast", platforms: ["dc"], os: ALL_OS, status: "active", homepage: "https://github.com/flyinghead/flycast", exe: "flycast.exe", args: ["{rom}"], needsBios: true, notes: "BIOS do Dreamcast (dc_boot.bin, dc_flash.bin)." },
  { id: "mesen", name: "MesenCE (fork do Mesen)", platforms: ["nes", "snes", "pce", "sms", "gg", "gb", "gba"], os: ALL_OS, status: "community-fork", homepage: "https://github.com/nesdev-org/MesenCE", exe: "Mesen.exe", args: ["{rom}"], needsBios: false, notes: "Alta precisão para 8/16 bits. O Mesen2 original foi arquivado em jun/2026; o MesenCE é o fork mantido." },
  { id: "mame", name: "MAME", platforms: ["arcade", "neogeo"], os: ALL_OS, status: "active", homepage: "https://www.mamedev.org", exe: "mame.exe", args: ["{rom}"], needsBios: true, notes: "Usa o nome do set (ex.: sf2) e exige o set de ROMs correspondente na pasta roms." },
  { id: "scummvm", name: "ScummVM", platforms: ["dos"], os: ALL_OS, status: "active", homepage: "https://www.scummvm.org", exe: "scummvm.exe", args: ["--fullscreen", "{rom}"], needsBios: false, notes: "Aventuras gráficas clássicas; recebe o ID do jogo." },
  {
    id: "retroarch",
    name: "RetroArch",
    platforms: ["nes", "snes", "gb", "gbc", "gba", "genesis", "sms", "gg", "pce", "neogeo", "atari2600", "arcade", "saturn", "dc", "n64", "ps1", "psp", "nds", "dos"],
    os: ALL_OS,
    status: "active",
    homepage: "https://www.retroarch.com",
    exe: "retroarch.exe",
    args: ["-L", "{core}", "--fullscreen", "{rom}"],
    cores: {
      nes: "mesen_libretro", snes: "snes9x_libretro", gb: "gambatte_libretro", gbc: "gambatte_libretro",
      gba: "mgba_libretro", genesis: "genesis_plus_gx_libretro", sms: "genesis_plus_gx_libretro",
      gg: "genesis_plus_gx_libretro", pce: "mednafen_pce_fast_libretro", neogeo: "fbneo_libretro",
      atari2600: "stella_libretro", arcade: "mame_libretro", saturn: "mednafen_saturn_libretro",
      dc: "flycast_libretro", n64: "mupen64plus_next_libretro", ps1: "swanstation_libretro",
      psp: "ppsspp_libretro", nds: "melonds_libretro", dos: "dosbox_pure_libretro",
    },
    needsBios: false,
    notes: "Frontend único com cores (libretro); BIOS depende do core (Saturn, PS1, Dreamcast).",
  },
];

/** Official download page and verified package ids are merged in from emulatorSources.ts. */
export const EMULATORS: Emulator[] = [...CORE, ...MORE_EMULATORS].map((e) => ({ ...e, install: INSTALL_SOURCES[e.id] }));

export const EMULATOR_BY_ID: Record<string, Emulator> = Object.fromEntries(
  EMULATORS.map((e) => [e.id, e]),
);

/** Dedicated emulators first (usually the most accurate), RetroArch last. */
export function emulatorsFor(platformId: string): Emulator[] {
  return EMULATORS.filter((e) => e.platforms.includes(platformId)).sort(
    (a, b) => Number(a.id === "retroarch") - Number(b.id === "retroarch"),
  );
}

/**
 * Pinned defaults: a game without an explicit emulator resolves through here, and scans persist the
 * result, so growing the catalog must never silently change it. Other platforms use the first
 * active dedicated emulator.
 */
const PINNED_DEFAULT: Record<string, string> = {
  nes: "mesen", snes: "mesen", pce: "mesen", sms: "mesen", gg: "mesen",
  n64: "retroarch", genesis: "retroarch", saturn: "retroarch", atari2600: "retroarch",
};

export function defaultEmulator(platformId: string): Emulator | undefined {
  const list = emulatorsFor(platformId);
  const pinned = list.find((e) => e.id === PINNED_DEFAULT[platformId]);
  return pinned ?? list.find((e) => e.status === "active") ?? list[0];
}

/** Current-gen platforms with no usable emulator, shown as a coverage gap. */
export const NO_EMULATOR_NOTE: Record<string, string> = {
  ps5: "Ainda não há emulador utilizável para PS5.",
  xone: "Sem emulador utilizável para Xbox One.",
  xsx: "Sem emulador utilizável para Xbox Series X|S.",
};
