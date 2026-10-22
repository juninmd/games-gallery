import { create } from "zustand";
import { persist } from "zustand/middleware";
import { EMULATOR_BY_ID } from "../domain/emulators";
import { PROVIDER_BY_ID } from "../domain/providers";
import type { BackupData } from "../domain/backup";
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
      removeGame: (id) => set((s) => ({ games: s.games.filter((g) => g.id !== id) })),

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
      uninstallGame: (id) => get().patchGame(id, { installed: false }),

      connectProvider: (id) => {
        const p = PROVIDER_BY_ID[id];
        useTasks.getState().run(`conn:${id}`, `Conectando ${p?.name ?? id}`, 1500, () => {
          set((s) => ({ providers: { ...s.providers, [id]: { connected: true, lastSync: new Date().toISOString() } } }));
          toast(`${p?.name ?? id} conectado`);
        });
      },
      disconnectProvider: (id) =>
        set((s) => ({ providers: { ...s.providers, [id]: { connected: false } } })),
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
      uninstallEmulator: (id) => set((s) => ({ emulators: { ...s.emulators, [id]: false } })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      restore: (data) => set({ games: data.games, scans: data.scans, providers: data.providers, emulators: data.emulators, settings: { ...get().settings, ...Object.fromEntries(Object.entries(data.settings).filter(([, v]) => v)) } }),
      reset: () => set(initial()),
    }),
    {
      name: "games-gallery:v1",
      version: 3,
      // v1 -> v2 backfilled `steamAppId` from the seed; v2 -> v3 added `scans`.
      migrate: (persisted, version) => {
        const state = persisted as Partial<LibraryState>;
        if (version < 2 && state.games) {
          const seed = new Map(SEED_GAMES.map((g) => [g.id, g]));
          state.games = state.games.map((g) => ({ ...g, steamAppId: g.steamAppId ?? seed.get(g.id)?.steamAppId }));
        }
        return { ...state, scans: state.scans ?? [] } as LibraryState;
      },
      partialize: ({ games, scans, providers, emulators, settings }) => ({ games, scans, providers, emulators, settings }),
    },
  ),
);
