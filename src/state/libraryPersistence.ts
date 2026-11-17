import { sanitizeGame, sanitizeScans } from "../domain/backup";
import { EMULATOR_BY_ID } from "../domain/emulators";
import { PROVIDER_BY_ID } from "../domain/providers";
import type { Game, ProviderState } from "../domain/types";

export interface Settings {
  romsDir: string;
  emulatorsDir: string;
}

/** Record of a finished scan; the folder itself is not kept (access is re-granted on each pick). */
export interface ScanRecord {
  id: string;
  kind: "roms" | "games";
  name: string;
  path?: string;
  at: string;
  added: number;
  linked: number;
}

export const initialLibrary = () => ({
  games: [] as Game[],
  scans: [] as ScanRecord[],
  providers: {} as Record<string, ProviderState>,
  emulators: {} as Record<string, boolean>,
  emulatorPaths: {} as Record<string, string>,
  settings: { romsDir: "", emulatorsDir: "" } as Settings,
});

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const has = (rec: object, key: string) => Object.prototype.hasOwnProperty.call(rec, key);

/** Invalid roots and nonempty all-invalid arrays fall back; an explicit [] remains an intentional empty library. */
function persistedGames(raw: unknown): Game[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const games = raw.flatMap((item): Game[] => {
    const game = sanitizeGame(item, "storage");
    if (!game || seen.has(game.id)) return [];
    seen.add(game.id);
    return [game];
  });
  return raw.length > 0 && games.length === 0 ? undefined : games;
}

function persistedProviders(raw: Record<string, unknown>): Record<string, ProviderState> {
  const providers: Record<string, ProviderState> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!has(PROVIDER_BY_ID, id) || !isObj(value) || typeof value["connected"] !== "boolean") continue;
    const lastSync = typeof value["lastSync"] === "string" && value["lastSync"].length <= 60 ? value["lastSync"] : undefined;
    const source = typeof value["source"] === "string" && value["source"].length <= 200 ? value["source"] : undefined;
    const note = typeof value["note"] === "string" && value["note"].length <= 500 ? value["note"] : undefined;
    providers[id] = { connected: value["connected"], lastSync, source, note };
  }
  return providers;
}

function persistedEmulators(raw: Record<string, unknown>): Record<string, boolean> {
  const emulators: Record<string, boolean> = {};
  for (const [id, installed] of Object.entries(raw)) {
    if (has(EMULATOR_BY_ID, id) && typeof installed === "boolean") emulators[id] = installed;
  }
  return emulators;
}

function persistedPaths(raw: unknown): Record<string, string> {
  const paths: Record<string, string> = {};
  if (!isObj(raw)) return paths;
  for (const [id, value] of Object.entries(raw)) {
    if (has(EMULATOR_BY_ID, id) && typeof value === "string" && value.length <= 4000) paths[id] = value;
  }
  return paths;
}

function persistedSettings(raw: unknown): Partial<Settings> {
  if (!isObj(raw)) return {};
  const settings: Partial<Settings> = {};
  for (const key of ["romsDir", "emulatorsDir"] as const) {
    const value = raw[key];
    if (typeof value === "string") settings[key] = value;
  }
  return settings;
}
export type LibraryData = ReturnType<typeof initialLibrary>;

/**
 * v4 removes the prototype demo data: the seed games, the fake "connected" providers and the
 * emulators that were only marked as installed. Real data is re-detected from disk.
 */
export function migrateLibrary(persisted: unknown, version: number) {
  const state = isObj(persisted) ? persisted : {};
  const defaults = initialLibrary();
  if (version < 4) {
    return {
      ...defaults,
      scans: Array.isArray(state["scans"]) ? sanitizeScans(state["scans"], "storage") : [],
      settings: { ...defaults.settings, ...persistedSettings(state["settings"]) },
    };
  }
  return {
    games: persistedGames(state["games"]) ?? defaults.games,
    scans: Array.isArray(state["scans"]) ? sanitizeScans(state["scans"], "storage") : [],
    providers: isObj(state["providers"]) ? persistedProviders(state["providers"]) : defaults.providers,
    emulators: isObj(state["emulators"]) ? persistedEmulators(state["emulators"]) : defaults.emulators,
    emulatorPaths: persistedPaths(state["emulatorPaths"]),
    settings: { ...defaults.settings, ...persistedSettings(state["settings"]) },
  };
}

export function mergeLibrary<T extends LibraryData>(persisted: unknown, current: T): T {
  const state = isObj(persisted) ? persisted : {};
  const games = persistedGames(state["games"]);
  return {
    ...current,
    ...(games !== undefined ? { games } : {}),
    ...(Array.isArray(state["scans"]) ? { scans: sanitizeScans(state["scans"], "storage") } : {}),
    ...(isObj(state["providers"]) ? { providers: persistedProviders(state["providers"]) } : {}),
    ...(isObj(state["emulators"]) ? { emulators: persistedEmulators(state["emulators"]) } : {}),
    emulatorPaths: persistedPaths(state["emulatorPaths"]),
    settings: { ...current.settings, ...persistedSettings(state["settings"]) },
  };
}
