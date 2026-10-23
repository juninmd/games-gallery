import type { EmulatorInstall } from "./types";

/**
 * Official download page plus package-manager ids, checked on 2026-10-22: the page against the
 * project's own site/repo, ids with `winget show --exact`, Scoop manifests on GitHub, the Flathub
 * appstream API and formulae.brew.sh. Ids that could not be resolved, or that point to a third-party
 * publisher or an archived upstream, are left out on purpose: the official page is the fallback.
 */
export const INSTALL_SOURCES: Record<string, EmulatorInstall> = {
  duckstation: { downloadUrl: "https://duckstation.org/windl.html", winget: "Stenzek.DuckStation", scoop: "games/duckstation", flatpak: "org.duckstation.DuckStation" },
  pcsx2: { downloadUrl: "https://pcsx2.net/downloads", winget: "PCSX2Team.PCSX2", scoop: "games/pcsx2", flatpak: "net.pcsx2.PCSX2", brew: { kind: "cask", name: "pcsx2" } },
  rpcs3: { downloadUrl: "https://github.com/RPCS3/rpcs3", scoop: "games/rpcs3", flatpak: "net.rpcs3.RPCS3" },
  shadps4: { downloadUrl: "https://shadps4.net/downloads", winget: "shadps4-emu.shadPS4", scoop: "games/shadps4", flatpak: "net.shadps4.shadPS4" },
  ppsspp: { downloadUrl: "https://ppsspp.org/download", winget: "PPSSPPTeam.PPSSPP", scoop: "games/ppsspp", flatpak: "org.ppsspp.PPSSPP", brew: { kind: "formula", name: "ppsspp" } },
  vita3k: { downloadUrl: "https://vita3k.org/download", winget: "Vita3K.Vita3K", scoop: "games/vita3k" },
  xemu: { downloadUrl: "https://xemu.app/docs/download", winget: "xemu-project.xemu", scoop: "games/xemu", flatpak: "app.xemu.xemu", brew: { kind: "cask", name: "xemu" } },
  xenia: { downloadUrl: "https://github.com/xenia-canary/xenia-canary/releases", winget: "Xenia.XeniaCanary", scoop: "games/xenia" },
  dolphin: { downloadUrl: "https://github.com/dolphin-emu/dolphin/tags", winget: "DolphinEmulator.Dolphin", scoop: "extras/dolphin", flatpak: "org.DolphinEmu.dolphin-emu", brew: { kind: "cask", name: "dolphin" } },
  cemu: { downloadUrl: "https://github.com/cemu-project/Cemu/releases", winget: "Cemu.Cemu", scoop: "games/cemu", flatpak: "info.cemu.Cemu", brew: { kind: "cask", name: "cemu" } },
  ryubing: { downloadUrl: "https://ryujinx.app" },
  eden: { downloadUrl: "https://git.eden-emu.dev/eden-emu/eden/releases", scoop: "games/eden", flatpak: "dev.eden_emu.eden" },
  azahar: { downloadUrl: "https://github.com/azahar-emu/azahar/releases", winget: "AzaharEmu.Azahar", scoop: "games/azahar", flatpak: "org.azahar_emu.Azahar" },
  melonds: { downloadUrl: "https://github.com/melonDS-emu/melonDS", winget: "melonDS.melonDS", scoop: "games/melonds", flatpak: "net.kuribo64.melonDS", brew: { kind: "cask", name: "melonds" } },
  mgba: { downloadUrl: "https://mgba.io/downloads.html", winget: "JeffreyPfau.mGBA", scoop: "games/mgba", flatpak: "io.mgba.mGBA", brew: { kind: "formula", name: "mgba" } },
  flycast: { downloadUrl: "https://github.com/flyinghead/flycast/releases", scoop: "games/flycast", flatpak: "org.flycast.Flycast", brew: { kind: "cask", name: "flycast" } },
  mesen: { downloadUrl: "https://github.com/nesdev-org/MesenCE/releases" },
  mame: { downloadUrl: "https://www.mamedev.org/release.html", winget: "MAMEdev.MAME", scoop: "games/mame", flatpak: "org.mamedev.MAME", brew: { kind: "formula", name: "mame" } },
  scummvm: { downloadUrl: "https://www.scummvm.org/downloads/", winget: "ScummVM.ScummVM", scoop: "games/scummvm", flatpak: "org.scummvm.ScummVM", brew: { kind: "formula", name: "scummvm" } },
  retroarch: { downloadUrl: "https://www.retroarch.com/platforms.html", winget: "Libretro.RetroArch", scoop: "extras/retroarch", flatpak: "org.libretro.RetroArch", brew: { kind: "cask", name: "retroarch" } },
  project64: { downloadUrl: "https://www.pj64-emu.com/", winget: "Project64.Project64" },
  snes9x: { downloadUrl: "https://github.com/snes9xgit/snes9x/releases", flatpak: "com.snes9x.Snes9x", brew: { kind: "cask", name: "snes9x" } },
  bsnes: { downloadUrl: "https://github.com/bsnes-emu/bsnes", winget: "bsnes-emu.BSNES" },
  fceux: { downloadUrl: "https://fceux.com/web/download.html", winget: "FCEUX.FCEUX", brew: { kind: "formula", name: "fceux" } },
  ares: { downloadUrl: "https://ares-emu.net/download", winget: "ares-emulator.ares", flatpak: "dev.ares.ares", brew: { kind: "formula", name: "ares" } },
  mednafen: { downloadUrl: "https://mednafen.github.io/", winget: "MednafenTeam.Mednafen", scoop: "extras/mednafen", brew: { kind: "formula", name: "mednafen" } },
  bizhawk: { downloadUrl: "https://github.com/TASEmulators/BizHawk/releases/latest", winget: "TASEmulators.BizHawk", scoop: "extras/bizhawk" },
  sameboy: { downloadUrl: "https://sameboy.github.io/downloads/", winget: "LIJI32.SameBoy", flatpak: "io.github.sameboy.SameBoy", brew: { kind: "cask", name: "sameboy" } },
  "vba-m": { downloadUrl: "https://github.com/visualboyadvance-m/visualboyadvance-m/releases", winget: "VisualBoyAdvance-M.VisualBoyAdvance-M", brew: { kind: "cask", name: "visualboyadvance-m" } },
  stella: { downloadUrl: "https://stella-emu.github.io/downloads.html", winget: "TheStellaTeam.Stella", brew: { kind: "formula", name: "stella" } },
  "dosbox-staging": { downloadUrl: "https://www.dosbox-staging.org/download/", winget: "DOSBoxStaging.DOSBoxStaging", scoop: "extras/dosbox-staging", brew: { kind: "formula", name: "dosbox-staging" } },
  "dosbox-x": { downloadUrl: "https://github.com/joncampbell123/dosbox-x/releases", winget: "joncampbell123.DOSBox-X", scoop: "extras/dosbox-x", flatpak: "com.dosbox_x.DOSBox-X", brew: { kind: "formula", name: "dosbox-x" } },
  ymir: { downloadUrl: "https://github.com/StrikerX3/Ymir/releases" },
  redream: { downloadUrl: "https://redream.io/download", winget: "redream.redream", brew: { kind: "cask", name: "redream" } },
  fbneo: { downloadUrl: "https://github.com/finalburnneo/FBNeo" },
};
