import type { Emulator, EmulatorInstall, Os } from "./types";

export type Manager = "winget" | "scoop" | "flatpak" | "brew";

export interface InstallCommand {
  manager: Manager;
  label: string;
  /** Shown and copied as-is; one line per shell command. */
  command: string;
}

// Ids are interpolated into text a user will paste into a terminal: only these shapes are accepted.
const WINGET_ID = /^[A-Za-z0-9][A-Za-z0-9.+_-]*$/;
const SCOOP_REF = /^[a-z0-9_-]+\/[A-Za-z0-9._+-]+$/;
const FLATPAK_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const BREW_NAME = /^[a-z0-9][a-z0-9@._+-]*$/;

export const MANAGER_OS: Record<Manager, Os> = { winget: "windows", scoop: "windows", flatpak: "linux", brew: "macos" };
export const MANAGER_LABEL: Record<Manager, string> = { winget: "winget", scoop: "Scoop", flatpak: "Flatpak (Flathub)", brew: "Homebrew" };

export function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Every command this emulator offers, in a stable order, skipping ids with an unexpected shape. */
export function installCommands(install: EmulatorInstall | undefined): InstallCommand[] {
  if (!install) return [];
  const out: InstallCommand[] = [];
  if (install.winget && WINGET_ID.test(install.winget)) {
    out.push({ manager: "winget", label: MANAGER_LABEL.winget, command: `winget install --id ${install.winget} --exact --source winget` });
  }
  if (install.scoop && SCOOP_REF.test(install.scoop)) {
    const bucket = install.scoop.split("/")[0];
    out.push({
      manager: "scoop",
      label: MANAGER_LABEL.scoop,
      command: `${bucket === "main" ? "" : `scoop bucket add ${bucket}\n`}scoop install ${install.scoop}`,
    });
  }
  if (install.flatpak && FLATPAK_ID.test(install.flatpak)) {
    out.push({ manager: "flatpak", label: MANAGER_LABEL.flatpak, command: `flatpak install flathub ${install.flatpak}` });
  }
  if (install.brew && BREW_NAME.test(install.brew.name)) {
    out.push({
      manager: "brew",
      label: MANAGER_LABEL.brew,
      command: `brew install ${install.brew.kind === "cask" ? "--cask " : ""}${install.brew.name}`,
    });
  }
  return out;
}

/** Commands for one OS first, so the host's package manager is the first thing shown. */
export function commandsFor(install: EmulatorInstall | undefined, os: Os): InstallCommand[] {
  return installCommands(install).sort((a, b) => Number(MANAGER_OS[b.manager] === os) - Number(MANAGER_OS[a.manager] === os));
}

/** One script with a commented line per emulator; emulators without that manager are listed as skipped. */
export function installScript(emulators: Emulator[], manager: Manager): string {
  const lines = [`# Games Gallery: ${MANAGER_LABEL[manager]} install script`, "# Review before running. Official download pages are in the app."];
  const skipped: string[] = [];
  for (const e of emulators) {
    const cmd = installCommands(e.install).find((c) => c.manager === manager);
    if (cmd) lines.push("", `# ${e.name}`, cmd.command);
    else skipped.push(e.name);
  }
  if (skipped.length) lines.push("", `# No ${MANAGER_LABEL[manager]} package verified for: ${skipped.join(", ")}`);
  return lines.join("\n");
}

export function hostOs(userAgent: string): Os {
  if (/Windows/i.test(userAgent)) return "windows";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "macos";
  return "linux";
}
