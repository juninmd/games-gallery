import { create } from "zustand";
import { persist } from "zustand/middleware";
import { EMULATOR_BY_ID } from "../domain/emulators";
import { PROVIDER_BY_ID } from "../domain/providers";
import { sanitizeGame, sanitizeScans, type BackupData } from "../domain/backup";
import { type ImportItem, applyImport } from "../domain/scan/plan";
import { SEED_GAMES, SEED_INSTALLED_EMULATORS } from "../domain/seed";
import type { Game } from "../domain/types";
import { useTasks } from "./tasks";
import { useUi } from "./ui";

interface ProviderState {
  connected: boolean;
  lastSync?: string;
}

interface Settings {
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

interface LibraryState {
  games: Game[];
  scans: ScanRecord[];
  providers: Record<string, ProviderState>;
  emulators: Record<string, boolean>;
  settings: Settings;
  patchGame: (id: string, patch: Partial<Game>) => void;
  addGame: (game: Game) => void;
  importItems: (items: ImportItem[], scan: Omit<ScanRecord, "id" | "at" | "added" | "linked">) => void;
  removeGame: (id: string) => void;
  installGame: (id: string) => void;
  uninstallGame: (id: string) => void;
  connectProvider: (id: string) => void;
  disconnectProvider: (id: string) => void;
  syncProvider: (id: string) => void;
  installEmulator: (id: string) => void;
  uninstallEmulator: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  restore: (data: BackupData) => void;
  reset: () => void;
}

const toast = (msg: string) => useUi.getState().toast(msg);

const initial = () => ({
  games: SEED_GAMES,
  scans: [] as ScanRecord[],
  providers: Object.fromEntries(
    [...new Set(SEED_GAMES.map((g) => g.providerId))].map((id) => [
      id,
      { connected: true, lastSync: "2026-10-21T22:10:00" },
    ]),
  ),
  emulators: Object.fromEntries(SEED_INSTALLED_EMULATORS.map((id) => [id, true])),
  settings: { romsDir: "D:/ROMs", emulatorsDir: "D:/Emulators" },
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
    providers[id] = { connected: value["connected"], lastSync };
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

function persistedSettings(raw: unknown): Partial<Settings> {
  if (!isObj(raw)) return {};
  const settings: Partial<Settings> = {};
  for (const key of ["romsDir", "emulatorsDir"] as const) {
    const value = raw[key];
    if (typeof value === "string") settings[key] = value;
  }
  return settings;
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      ...initial(),
      patchGame: (id, patch) =>
        set((s) => ({ games: s.games.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      addGame: (game) => set((s) => ({ games: [game, ...s.games] })),
      importItems: (items, scan) =>
        set((s) => ({
          games: applyImport(s.games, items),
          scans: [
            { ...scan, id: `${Date.now()}`, at: new Date().toISOString(), added: items.filter((i) => i.kind === "new").length, linked: items.filter((i) => i.kind === "link").length },
            ...s.scans,
          ].slice(0, 10),
        })),
      removeGame: (id) => {
        useTasks.getState().cancel(`game:${id}`);
        set((s) => ({ games: s.games.filter((g) => g.id !== id) }));
      },

      installGame: (id) => {
        const g = get().games.find((x) => x.id === id);
        if (!g) return;
        useTasks.getState().run(`game:${id}`, `Instalando ${g.title}`, 3000, () => {
          // State may have changed during the "download": removed, reset or moved to wishlist.
          const now = get().games.find((x) => x.id === id);
          if (!now?.owned) return;
          get().patchGame(id, { installed: true });
          toast(`${g.title} instalado`);
        });
      },
      uninstallGame: (id) => {
        useTasks.getState().cancel(`game:${id}`);
        get().patchGame(id, { installed: false });
      },

      connectProvider: (id) => {
        const p = PROVIDER_BY_ID[id];
        useTasks.getState().run(`conn:${id}`, `Conectando ${p?.name ?? id}`, 1500, () => {
          set((s) => ({ providers: { ...s.providers, [id]: { connected: true, lastSync: new Date().toISOString() } } }));
          toast(`${p?.name ?? id} conectado`);
        });
      },
      disconnectProvider: (id) => {
        useTasks.getState().cancel(`conn:${id}`);
        useTasks.getState().cancel(`sync:${id}`);
        set((s) => ({ providers: { ...s.providers, [id]: { connected: false } } }));
      },
      syncProvider: (id) => {
        const p = PROVIDER_BY_ID[id];
        useTasks.getState().run(`sync:${id}`, `Sincronizando ${p?.name ?? id}`, 2500, () => {
          set((s) => ({ providers: { ...s.providers, [id]: { connected: true, lastSync: new Date().toISOString() } } }));
          toast(`${p?.name ?? id}: biblioteca atualizada`);
        });
      },

      installEmulator: (id) => {
        const e = EMULATOR_BY_ID[id];
        if (!e) return;
        useTasks.getState().run(`emu:${id}`, `Baixando ${e.name}`, 3500, () => {
          set((s) => ({ emulators: { ...s.emulators, [id]: true } }));
          toast(`${e.name} instalado`);
        });
      },
      uninstallEmulator: (id) => {
        useTasks.getState().cancel(`emu:${id}`);
        set((s) => ({ emulators: { ...s.emulators, [id]: false } }));
      },

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      restore: (data) => {
        useTasks.getState().cancelAll();
        set((s) => ({
          games: data.games,
          scans: data.scans,
          providers: data.providers ?? s.providers,
          emulators: data.emulators ?? s.emulators,
          settings: { ...s.settings, ...data.settings },
        }));
      },
      reset: () => {
        useTasks.getState().cancelAll();
        set(initial());
      },
    }),
    {
      name: "games-gallery:v1",
      version: 3,
      // v1 -> v2 backfilled `steamAppId` from the seed; v2 -> v3 added `scans`.
      migrate: (persisted, version) => {
        const state = isObj(persisted) ? persisted : {};
        const defaults = initial();
        let games = persistedGames(state["games"]) ?? defaults.games;
        if (version < 2) {
          const seed = new Map(SEED_GAMES.map((g) => [g.id, g]));
          games = games.map((g) => ({ ...g, steamAppId: g.steamAppId ?? seed.get(g.id)?.steamAppId }));
        }
        return {
          games,
          scans: Array.isArray(state["scans"]) ? sanitizeScans(state["scans"], "storage") : [],
          providers: isObj(state["providers"]) ? persistedProviders(state["providers"]) : defaults.providers,
          emulators: isObj(state["emulators"]) ? persistedEmulators(state["emulators"]) : defaults.emulators,
          settings: { ...defaults.settings, ...persistedSettings(state["settings"]) },
        };
      },
      partialize: ({ games, scans, providers, emulators, settings }) => ({ games, scans, providers, emulators, settings }),
      merge: (persisted, current) => {
        const state = isObj(persisted) ? persisted : {};
        const games = persistedGames(state["games"]);
        return {
          ...current,
          ...(games !== undefined ? { games } : {}),
          ...(Array.isArray(state["scans"]) ? { scans: sanitizeScans(state["scans"], "storage") } : {}),
          ...(isObj(state["providers"]) ? { providers: persistedProviders(state["providers"]) } : {}),
          ...(isObj(state["emulators"]) ? { emulators: persistedEmulators(state["emulators"]) } : {}),
          settings: { ...current.settings, ...persistedSettings(state["settings"]) },
        };
      },
    },
  ),
);
