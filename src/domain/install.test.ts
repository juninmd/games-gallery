import { describe, expect, it } from "vitest";
import { EMULATORS, defaultEmulator } from "./emulators";
import { PLATFORM_BY_ID } from "./platforms";
import { commandsFor, hostOs, installCommands, installScript, isHttps } from "./install";
import type { Emulator, EmulatorInstall } from "./types";

const full: EmulatorInstall = {
  downloadUrl: "https://example.org/download",
  winget: "Vendor.App",
  scoop: "extras/app",
  flatpak: "org.vendor.App",
  brew: { kind: "cask", name: "app" },
};

describe("installCommands", () => {
  it("builds one command per manager from ids only", () => {
    expect(installCommands(full).map((c) => c.command)).toEqual([
      "winget install --id Vendor.App --exact --source winget",
      "scoop bucket add extras\nscoop install extras/app",
      "flatpak install flathub org.vendor.App",
      "brew install --cask app",
    ]);
  });
  it("uses `brew install` without --cask for formulae and skips the bucket step for main", () => {
    const cmds = installCommands({ downloadUrl: full.downloadUrl, scoop: "main/app", brew: { kind: "formula", name: "app" } });
    expect(cmds.map((c) => c.command)).toEqual(["scoop install main/app", "brew install app"]);
  });
  it("returns nothing without install data", () => {
    expect(installCommands(undefined)).toEqual([]);
  });
  it.each([
    ["winget", { winget: "App; calc.exe" }],
    ["winget", { winget: "$(whoami)" }],
    ["scoop", { scoop: "extras/app && del *" }],
    ["scoop", { scoop: "no-bucket" }],
    ["flatpak", { flatpak: "org.x y" }],
    ["brew", { brew: { kind: "cask" as const, name: "a`b`" } }],
    ["brew", { brew: { kind: "formula" as const, name: "-flag" } }],
  ])("drops a %s id that is not a plain identifier", (_m, partial) => {
    expect(installCommands({ downloadUrl: full.downloadUrl, ...partial })).toEqual([]);
  });
});

describe("commandsFor", () => {
  it("lists the host OS package managers first", () => {
    expect(commandsFor(full, "linux")[0]?.manager).toBe("flatpak");
    expect(commandsFor(full, "macos")[0]?.manager).toBe("brew");
    expect(commandsFor(full, "windows").slice(0, 2).map((c) => c.manager)).toEqual(["winget", "scoop"]);
  });
});

describe("installScript", () => {
  const emu = (id: string, install?: EmulatorInstall): Emulator => ({
    id, name: id.toUpperCase(), platforms: ["gba"], os: ["windows"], status: "active", exe: "x.exe", args: ["{rom}"], needsBios: false, notes: "", install,
  });
  it("emits a commented command per emulator and lists the ones without that manager", () => {
    const text = installScript([emu("a", full), emu("b", { downloadUrl: full.downloadUrl, flatpak: "org.b.B" })], "winget");
    expect(text).toContain("# A\nwinget install --id Vendor.App --exact --source winget");
    expect(text).toContain("# No winget package verified for: B");
    expect(text.startsWith("# Games Gallery: winget install script")).toBe(true);
  });
});

describe("helpers", () => {
  it("accepts only https URLs", () => {
    expect(isHttps("https://dolphin-emu.org/download/")).toBe(true);
    expect(isHttps("http://dolphin-emu.org")).toBe(false);
    expect(isHttps("javascript:alert(1)")).toBe(false);
    expect(isHttps("not a url")).toBe(false);
  });
  it("detects the host OS from the user agent", () => {
    expect(hostOs("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(hostOs("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("macos");
    expect(hostOs("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
  });
});

describe("catalog install data", () => {
  const withInstall = EMULATORS.filter((e) => e.install);
  it("every emulator with install data has an https official download page", () => {
    for (const e of withInstall) expect(isHttps(e.install!.downloadUrl), e.id).toBe(true);
  });
  it("no declared package id is silently dropped by validation", () => {
    for (const e of withInstall) {
      const i = e.install!;
      const declared = [i.winget, i.scoop, i.flatpak, i.brew].filter(Boolean).length;
      expect(installCommands(i).length, e.id).toBe(declared);
    }
  });
  it("emulator ids are unique and every platform exists in the platform catalog", () => {
    expect(new Set(EMULATORS.map((e) => e.id)).size).toBe(EMULATORS.length);
    for (const e of EMULATORS) for (const p of e.platforms) expect(PLATFORM_BY_ID[p], `${e.id}:${p}`).toBeDefined();
  });
  it("defaults prefer an active dedicated emulator; the archived Mesen upstream no longer wins", () => {
    const expected: Record<string, string> = { ps1: "duckstation", ps2: "pcsx2", snes: "snes9x", nes: "fceux", gba: "mgba", dos: "scummvm", dc: "flycast", n64: "project64" };
    for (const [platform, id] of Object.entries(expected)) expect(defaultEmulator(platform)?.id, platform).toBe(id);
  });
  it("every catalog emulator has a download page", () => {
    expect(EMULATORS.filter((e) => !e.install).map((e) => e.id)).toEqual([]);
  });
});
