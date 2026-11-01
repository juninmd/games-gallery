import { safeStoreId } from "../domain/detect";
import type { DetectedEntry, ProviderDetection } from "../domain/types";
import { isTauri } from "./runtime";

/**
 * Thin bridge over the Rust commands. Every call here does real work in the installed app:
 * reading launcher files, running a package manager, or spawning an emulator. In the browser
 * (`pnpm dev`) there is nothing to read, so the callers show an honest "only in the app" note.
 */

export const nativeAvailable = () => isTauri();

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

interface RawDetection {
  providerId: string;
  source: string;
  available: boolean;
  note?: string | null;
  games: Array<{
    storeId: string;
    title: string;
    sizeGb?: number | null;
    installed: boolean;
    installPath?: string | null;
    playtimeH?: number | null;
  }>;
}

const toEntry = (raw: RawDetection["games"][number]): DetectedEntry => ({
  storeId: safeStoreId(raw.storeId),
  title: raw.title,
  sizeGb: raw.sizeGb ?? undefined,
  installed: raw.installed,
  installPath: raw.installPath ?? undefined,
  playtimeH: raw.playtimeH ?? undefined,
});

/** One provider can be served by several files (Epic manifests + Legendary, GOG DB + Heroic). */
function mergeByProvider(list: ProviderDetection[]): ProviderDetection[] {
  const byProvider = new Map<string, ProviderDetection & { sources: string[]; notes: string[] }>();
  for (const detection of list) {
    const current = byProvider.get(detection.providerId);
    if (!current) {
      byProvider.set(detection.providerId, {
        ...detection,
        games: [...detection.games],
        sources: detection.available ? [detection.source] : [],
        notes: detection.note ? [detection.note] : [],
      });
      continue;
    }
    const seen = new Map(current.games.map((g) => [g.storeId, g]));
    for (const game of detection.games) {
      const previous = seen.get(game.storeId);
      if (!previous) {
        current.games.push(game);
        seen.set(game.storeId, game);
      } else if (game.installed && !previous.installed) {
        Object.assign(previous, { installed: true, installPath: game.installPath, sizeGb: game.sizeGb ?? previous.sizeGb });
      }
    }
    if (detection.available) current.sources.push(detection.source);
    else if (detection.note) current.notes.push(detection.note);
  }
  return [...byProvider.values()].map(({ sources, notes, ...detection }) => ({
    ...detection,
    available: sources.length > 0,
    source: sources.length ? sources.join(" + ") : detection.source,
    note: sources.length ? undefined : notes[0],
  }));
}

export async function detectLibraries(): Promise<ProviderDetection[]> {
  if (!isTauri()) return [];
  const raw = await invoke<RawDetection[]>("detect_libraries");
  return mergeByProvider(raw.map((d) => ({
    providerId: d.providerId,
    source: d.source,
    available: d.available,
    note: d.note ?? undefined,
    games: d.games.map(toEntry),
  })));
}

export interface EmulatorProbe {
  id: string;
  exe: string;
}

export async function detectEmulators(probes: EmulatorProbe[], extraDirs: string[]): Promise<Record<string, string>> {
  if (!isTauri() || !probes.length) return {};
  const found = await invoke<Array<{ id: string; exe?: string | null }>>("detect_emulators", { probes, extraDirs });
  const map: Record<string, string> = {};
  for (const item of found) if (item.exe) map[item.id] = item.exe;
  return map;
}

export interface InstallRequest {
  id: string;
  manager: string;
  package: string;
  bucket?: string;
  cask?: boolean;
}

export interface InstallOutcome {
  code: number;
  cancelled: boolean;
}

export async function emulatorInstall(request: InstallRequest): Promise<InstallOutcome> {
  if (!isTauri()) throw new Error("Instalação real só acontece no app instalado.");
  return invoke<InstallOutcome>("emulator_install", {
    id: request.id,
    manager: request.manager,
    package: request.package,
    bucket: request.bucket,
    cask: request.cask ?? false,
  });
}

export async function emulatorUninstall(request: Omit<InstallRequest, "bucket">): Promise<InstallOutcome> {
  if (!isTauri()) throw new Error("Remoção real só acontece no app instalado.");
  return invoke<InstallOutcome>("emulator_uninstall", {
    id: request.id,
    manager: request.manager,
    package: request.package,
    cask: request.cask ?? false,
  });
}

export async function emulatorCancel(id: string): Promise<boolean> {
  if (!isTauri()) return false;
  return invoke<boolean>("emulator_cancel", { id });
}

export async function launchEmulator(exe: string, args: string[]): Promise<number> {
  if (!isTauri()) throw new Error("Execução real só acontece no app instalado.");
  return invoke<number>("emulator_launch", { exe, args });
}

/** Streams the package manager's own output lines for the given emulator id. */
export async function onEmulatorOutput(handler: (payload: { id: string; line: string }) => void): Promise<() => void> {
  if (!isTauri()) return () => undefined;
  const { listen } = await import("@tauri-apps/api/event");
  return listen<{ id: string; line: string }>("emulator-output", (event) => handler(event.payload));
}

/** Libraries that live on a store server: the user signs in inside a throw-away native window. */
export type WindowLoginStore = "battlenet" | "ea" | "ubisoft";

export async function windowLoginLibrary(store: WindowLoginStore): Promise<DetectedEntry[]> {
  const games = await invoke<Array<{ storeId: string; title: string }>>(`${store}_library`);
  return games.map((g) => ({ storeId: safeStoreId(g.storeId), title: g.title, installed: false }));
}
