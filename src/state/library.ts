import { applyShared } from "../domain/duplicates";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sanitizeGame, sanitizeScans, type BackupData } from "../domain/backup";
import { combineDetections, detectionSummary, importItemsFrom, mergeDetections } from "../domain/detect";
import { EMULATOR_BY_ID, EMULATORS } from "../domain/emulators";
import { commandsFor, hostOs } from "../domain/install";
import { PROVIDER_BY_ID } from "../domain/providers";
import { planStoreImport } from "../domain/scan/plan";
import type { ImportItem } from "../domain/scan/plan";
import { applyImport } from "../domain/scan/plan";
import type { Game, ProviderDetection, ProviderState } from "../domain/types";
import {
  detectEmulators,
  detectLibraries,
  emulatorCancel,
  emulatorInstall,
  emulatorUninstall,
  nativeAvailable,
  windowLoginLibrary,
  type WindowLoginStore,
  onEmulatorOutput,
  type InstallRequest,
} from "../platform/native";
import type { AmazonDevice } from "../domain/amazonAccount";
import { importAmazonAccount } from "../platform/amazonAccount";
import { importEpicAccount } from "../platform/epicAccount";
import { isTauri, openStore } from "../platform/runtime";
import { fetchOwnedGames, isValidSteamId, isValidSteamKey } from "../platform/steamApi";
import { useSecrets } from "./secrets";
import { useTasks } from "./tasks";
import { useUi } from "./ui";

export type { ProviderState } from "../domain/types";

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
  /** emulatorId -> absolute executable found on disk. */
  emulatorPaths: Record<string, string>;
  settings: Settings;
  patchGame: (id: string, patch: Partial<Game>) => void;
  addGame: (game: Game) => void;
  importItems: (items: ImportItem[], scan: Omit<ScanRecord, "id" | "at" | "added" | "linked">) => void;
  removeGame: (id: string) => void;
  /** Reads every launcher installed on this machine (or just one provider). */
  detect: (providerId?: string) => Promise<void>;
  /** Steam Web API: whole account, with playtime. */
  syncSteamApi: () => Promise<void>;
  syncEpicAccount: (code: string) => Promise<void>;
  syncAmazonAccount: (pastedUrl: string, device: AmazonDevice) => Promise<void>;
  syncWindowLogin: (store: WindowLoginStore) => Promise<void>;
  installGame: (id: string) => Promise<void>;
  uninstallGame: (id: string) => Promise<void>;
  installEmulator: (id: string) => Promise<void>;
  uninstallEmulator: (id: string) => Promise<void>;
  cancelEmulator: (id: string) => Promise<void>;
  /** Re-resolves every catalog executable on disk (source of truth for "installed"). */
  refreshEmulators: () => Promise<void>;
  setSettings: (patch: Partial<Settings>) => void;
  restore: (data: BackupData) => void;
  reset: () => void;
}

const toast = (msg: string) => useUi.getState().toast(msg);
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const initial = () => ({
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

const MANAGER_FOR_OS = { windows: "winget", macos: "brew", linux: "flatpak" } as const;

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      ...initial(),

      patchGame: (id, patch) => set((s) => ({ games: applyShared(s.games, id, patch) })),
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

      detect: async (providerId) => {
        if (!nativeAvailable()) {
          toast("A leitura de bibliotecas locais só funciona no app instalado.");
          return;
        }
        const key = `detect:${providerId ?? "all"}`;
        const tasks = useTasks.getState();
        tasks.start(key, providerId ? `Lendo ${PROVIDER_BY_ID[providerId]?.name ?? providerId}` : "Lendo bibliotecas instaladas");
        try {
          const detections = combineDetections((await detectLibraries()).filter((d) => !providerId || d.providerId === providerId));
          tasks.update(key, { progress: 55, detail: detections.map((d) => `${d.providerId}: ${d.games.length}`).join(" · ") });
          const items = detections.flatMap((d) => importItemsFrom(d, get().games));
          const changed = items.filter((i) => i.kind !== "same");
          if (changed.length) {
            get().importItems(changed, {
              kind: "games",
              name: providerId ? `${PROVIDER_BY_ID[providerId]?.name ?? providerId} (detecção local)` : "Detecção local",
            });
          }
          set((s) => ({
            providers: {
              ...s.providers,
              ...Object.fromEntries(
                detections.map((d) => [d.providerId, { connected: d.available, lastSync: new Date().toISOString(), source: d.source, note: d.note } satisfies ProviderState]),
              ),
            },
          }));
          tasks.update(key, { progress: 100 });
          toast(detectionSummary(detections));
        } catch (e) {
          toast(`Não foi possível ler as bibliotecas: ${errorText(e)}`);
        } finally {
          useTasks.getState().done(key);
        }
      },

      syncWindowLogin: async (store) => {
        const name = { battlenet: "Battle.net", ea: "EA app", ubisoft: "Ubisoft Connect" }[store];
        const key = `sync:${store}-account`;
        const tasks = useTasks.getState();
        tasks.start(key, `Entre na janela da ${name} para ler a biblioteca`);
        try {
          const remote = await windowLoginLibrary(store);
          const local = nativeAvailable() ? (await detectLibraries()).filter((d) => d.providerId === store) : [];
          const merged = combineDetections([...local, { providerId: store, source: `Conta ${name}`, available: true, games: remote }]);
          const games = merged.flatMap((d) => d.games);
          const items = planStoreImport(store, games, get().games).filter((i) => i.kind !== "same");
          if (items.length) get().importItems(items, { kind: "games", name: `Conta ${name}` });
          set((s) => ({ providers: { ...s.providers, [store]: { connected: true, lastSync: new Date().toISOString(), source: merged[0]?.source ?? `Conta ${name}` } } }));
          toast(`${name}: ${games.length} jogos na conta (${games.filter((g) => g.installed).length} instalados).`);
        } catch (e) {
          toast(`${name}: ${errorText(e)}`);
        } finally {
          useTasks.getState().done(key);
        }
      },
      syncAmazonAccount: async (pastedUrl, device) => {
        const key = "sync:amazon-account";
        const tasks = useTasks.getState();
        tasks.start(key, "Lendo a biblioteca da conta Amazon Games");
        try {
          const remote = await importAmazonAccount(pastedUrl, device, undefined, toast);
          tasks.update(key, { progress: 70, detail: `${remote.length} jogos na conta` });
          const local = nativeAvailable() ? (await detectLibraries()).filter((d) => d.providerId === "amazon") : [];
          const merged = combineDetections([...local, { providerId: "amazon", source: "Conta Amazon Games", available: true, games: remote }]);
          const games = merged.flatMap((d) => d.games);
          const items = planStoreImport("amazon", games, get().games).filter((i) => i.kind !== "same");
          if (items.length) get().importItems(items, { kind: "games", name: "Conta Amazon Games" });
          set((s) => ({ providers: { ...s.providers, amazon: { connected: true, lastSync: new Date().toISOString(), source: merged[0]?.source ?? "Conta Amazon Games" } } }));
          toast(`Amazon Games: ${games.length} jogos na conta (${games.filter((g) => g.installed).length} instalados).`);
        } catch (e) {
          toast(`Amazon Games: ${errorText(e)}`);
        } finally {
          useTasks.getState().done(key);
        }
      },
      syncEpicAccount: async (code) => {
        const key = "sync:epic-account";
        const tasks = useTasks.getState();
        tasks.start(key, "Lendo a biblioteca da conta Epic");
        try {
          const remote = await importEpicAccount(code, (done, total) => tasks.update(key, { progress: Math.round((done / Math.max(total, 1)) * 90) }), undefined, toast);
          const local = nativeAvailable() ? (await detectLibraries()).filter((d) => d.providerId === "epic") : [];
          const merged = mergeDetections(local.flatMap((d) => d.games), remote);
          const items = planStoreImport("epic", merged, get().games).filter((i) => i.kind !== "same");
          if (items.length) get().importItems(items, { kind: "games", name: "Conta Epic" });
          set((s) => ({ providers: { ...s.providers, epic: { connected: true, lastSync: new Date().toISOString(), source: "Conta Epic + manifests .item" } } }));
          toast(`Epic: ${merged.length} jogos na conta (${merged.filter((g) => g.installed).length} instalados).`);
        } catch (e) {
          toast(`Epic: ${errorText(e)}`);
        } finally {
          useTasks.getState().done(key);
        }
      },
      syncSteamApi: async () => {
        const { steamId, steamKey } = useSecrets.getState();
        if (!isValidSteamId(steamId) || !isValidSteamKey(steamKey)) {
          toast("Informe o SteamID64 e a chave da Steam Web API em Ajustes.");
          return;
        }
        const key = "sync:steam-api";
        const tasks = useTasks.getState();
        tasks.start(key, "Sincronizando Steam Web API");
        try {
          const remote = await fetchOwnedGames(steamId, steamKey);
          tasks.update(key, { progress: 60, detail: `${remote.length} jogos na conta` });
          const local = nativeAvailable() ? (await detectLibraries()).filter((d) => d.providerId === "steam") : [];
          const localGames = local.flatMap((d) => d.games);
          const merged = mergeDetections(localGames, remote);
          const detection: ProviderDetection = {
            providerId: "steam",
            source: "Steam Web API + appmanifest",
            available: true,
            games: merged,
          };
          // The Web API lists the whole account: only the local manifests keep `installed` true.
          const items = planStoreImport("steam", detection.games, get().games).filter((i) => i.kind !== "same");
          if (items.length) get().importItems(items, { kind: "games", name: "Steam Web API" });
          set((s) => ({
            providers: {
              ...s.providers,
              steam: { connected: true, lastSync: new Date().toISOString(), source: detection.source },
            },
          }));
          tasks.update(key, { progress: 100 });
          toast(`Steam: ${merged.length} jogos na conta (${merged.filter((g) => g.installed).length} instalados).`);
        } catch (e) {
          toast(`Steam Web API: ${errorText(e)}`);
        } finally {
          useTasks.getState().done(key);
        }
      },

      installGame: async (id) => {
        const game = get().games.find((g) => g.id === id);
        if (!game) return;
        const provider = PROVIDER_BY_ID[game.providerId];
        if (game.platformId !== "pc") {
          if (!game.romPath?.trim()) {
            toast("Defina o caminho da ROM/ISO na aba Jogar antes de preparar o jogo.");
            return;
          }
          get().patchGame(id, { installed: true });
          toast(`${game.title} pronto para jogar`);
          return;
        }
        const storeId = game.storeId ?? (game.steamAppId ? String(game.steamAppId) : undefined);
        if (!storeId) {
          toast("Este jogo não tem ID da loja; edite o jogo para preencher.");
          return;
        }
        if (!provider?.installUri) {
          toast(`${provider?.name ?? "A loja"} não tem link de instalação: abra o launcher dela.`);
          return;
        }
        const result = await openStore(provider.installUri.replace("{id}", storeId));
        toast(result.ok ? `Instalação aberta no ${provider.name}` : result.error);
      },

      uninstallGame: async (id) => {
        const game = get().games.find((g) => g.id === id);
        if (!game) return;
        const provider = PROVIDER_BY_ID[game.providerId];
        if (game.platformId !== "pc" || !provider?.uninstallUri) {
          get().patchGame(id, { installed: false });
          toast(`${game.title} marcado como não instalado`);
          return;
        }
        const storeId = game.storeId ?? (game.steamAppId ? String(game.steamAppId) : undefined);
        if (!storeId) {
          get().patchGame(id, { installed: false });
          return;
        }
        const result = await openStore(provider.uninstallUri.replace("{id}", storeId));
        toast(result.ok ? `Desinstalação aberta no ${provider.name}` : result.error);
      },

      installEmulator: async (id) => {
        const emulator = EMULATOR_BY_ID[id];
        if (!emulator) return;
        if (!isTauri()) {
          toast("Instalar emulador pelo gerenciador de pacotes só funciona no app instalado.");
          return;
        }
        const taskKey = `emu:${id}`;
        if (useTasks.getState().tasks[taskKey]) return;
        const preferred = MANAGER_FOR_OS[hostOs(navigator.userAgent)];
        const commands = commandsFor(emulator.install, hostOs(navigator.userAgent));
        const chosen = commands.find((c) => c.manager === preferred) ?? commands[0];
        if (!chosen) {
          toast(`${emulator.name} não tem pacote verificado; baixe pela página oficial.`);
          return;
        }
        if (!window.confirm(`Instalar ${emulator.name} com ${chosen.label}? O comando roda de verdade no seu sistema.`)) return;
        const request: InstallRequest = { id, manager: chosen.manager, package: chosen.package, bucket: chosen.bucket, cask: chosen.cask };
        const tasks = useTasks.getState();
        tasks.start(taskKey, `Instalando ${emulator.name} (${chosen.label})`);
        let lines = 0;
        const unlisten = await onEmulatorOutput((payload) => {
          if (payload.id !== id) return;
          lines += 1;
          useTasks.getState().update(taskKey, { progress: Math.min(92, 10 + lines * 3), detail: payload.line });
        });
        try {
          tasks.update(taskKey, { progress: 5, detail: chosen.command });
          const outcome = await emulatorInstall(request);
          if (outcome.code !== 0) {
            toast(`${emulator.name}: ${chosen.label} terminou com código ${outcome.code}. Veja as linhas acima.`);
            return;
          }
          tasks.update(taskKey, { progress: 96, detail: "Conferindo o executável no disco…" });
          await get().refreshEmulators();
          const found = get().emulatorPaths[id];
          toast(found ? `${emulator.name} instalado em ${found}` : `${emulator.name}: o gerenciador terminou, mas o executável não foi encontrado; confira o caminho em Ajustes.`);
        } catch (e) {
          toast(`${emulator.name}: ${errorText(e)}`);
        } finally {
          unlisten();
          useTasks.getState().done(taskKey);
        }
      },

      uninstallEmulator: async (id) => {
        const emulator = EMULATOR_BY_ID[id];
        if (!emulator) return;
        const taskKey = `emu:${id}`;
        if (useTasks.getState().tasks[taskKey]) return;
        const preferred = MANAGER_FOR_OS[hostOs(navigator.userAgent)];
        const commands = commandsFor(emulator.install, hostOs(navigator.userAgent));
        const chosen = commands.find((c) => c.manager === preferred) ?? commands[0];
        if (!isTauri() || !chosen) {
          set((s) => ({ emulators: { ...s.emulators, [id]: false }, emulatorPaths: Object.fromEntries(Object.entries(s.emulatorPaths).filter(([key]) => key !== id)) }));
          toast(`${emulator.name} marcado como não instalado`);
          return;
        }
        const tasks = useTasks.getState();
        if (!window.confirm(`Remover ${emulator.name} com ${chosen.label}?`)) return;
        tasks.start(taskKey, `Removendo ${emulator.name} (${chosen.label})`);
        const unlisten = await onEmulatorOutput((payload) => {
          if (payload.id === id) useTasks.getState().update(taskKey, { detail: payload.line });
        });
        try {
          const outcome = await emulatorUninstall({ id, manager: chosen.manager, package: chosen.package, cask: chosen.cask });
          if (outcome.code !== 0) {
            toast(`${emulator.name}: remoção terminou com código ${outcome.code}.`);
            return;
          }
          await get().refreshEmulators();
          toast(`${emulator.name} removido`);
        } catch (e) {
          toast(`${emulator.name}: ${errorText(e)}`);
        } finally {
          unlisten();
          useTasks.getState().done(taskKey);
        }
      },

      cancelEmulator: async (id) => {
        useTasks.getState().cancel(`emu:${id}`);
        const killed = await emulatorCancel(id).catch(() => false);
        toast(killed ? "Instalação cancelada" : "Não há instalação em andamento");
      },

      refreshEmulators: async () => {
        if (!nativeAvailable()) return;
        try {
          const paths = await detectEmulators(
            EMULATORS.map((e) => ({ id: e.id, exe: e.exe })),
            [get().settings.emulatorsDir],
          );
          set(() => ({
            emulatorPaths: paths,
            emulators: Object.fromEntries(EMULATORS.map((e) => [e.id, !!paths[e.id]])),
          }));
        } catch (e) {
          toast(`Não foi possível conferir os emuladores: ${errorText(e)}`);
        }
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
        void get().refreshEmulators();
      },
      reset: () => {
        useTasks.getState().cancelAll();
        set(initial());
      },
    }),
    {
      name: "games-gallery:v1",
      version: 4,
      /**
       * v4 removes the prototype demo data: the seed games, the fake "connected" providers and the
       * emulators that were only marked as installed. Real data is re-detected from disk.
       */
      migrate: (persisted, version) => {
        const state = isObj(persisted) ? persisted : {};
        const defaults = initial();
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
      },
      partialize: ({ games, scans, providers, emulators, emulatorPaths, settings }) => ({ games, scans, providers, emulators, emulatorPaths, settings }),
      merge: (persisted, current) => {
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
      },
    },
  ),
);
