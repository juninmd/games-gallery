import { applyShared } from "../domain/duplicates";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BackupData } from "../domain/backup";
import { combineDetections, detectionSummary, importItemsFrom, mergeDetections } from "../domain/detect";
import { PROVIDER_BY_ID } from "../domain/providers";
import { planStoreImport } from "../domain/scan/plan";
import type { ImportItem } from "../domain/scan/plan";
import { applyImport } from "../domain/scan/plan";
import type { Game, ProviderDetection, ProviderState } from "../domain/types";
import { detectLibraries, nativeAvailable, windowLoginLibrary, type WindowLoginStore } from "../platform/native";
import type { AmazonDevice } from "../domain/amazonAccount";
import { importAmazonAccount } from "../platform/amazonAccount";
import { importEpicAccount } from "../platform/epicAccount";
import { openStore } from "../platform/runtime";
import { appStorage } from "../platform/stateStorage";
import { fetchOwnedGames, isValidSteamId, isValidSteamKey } from "../platform/steamApi";
import { fetchFamilySharedGames, isValidSteamToken, tagFamilyGames } from "../platform/steamFamily";
import { useSecrets } from "./secrets";
import { useTasks } from "./tasks";
import { useUi } from "./ui";
import { emulatorActions } from "./libraryEmulators";
import { psnActions } from "./libraryPsn";
import { initialLibrary, mergeLibrary, migrateLibrary, type ScanRecord, type Settings } from "./libraryPersistence";

export type { ProviderState } from "../domain/types";
export type { ScanRecord } from "./libraryPersistence";


export interface LibraryState {
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
  syncPsnAccount: (npsso: string) => Promise<void>;
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



export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      ...initialLibrary(),

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
        const { steamId, steamKey, steamToken } = useSecrets.getState();
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
          const owned = mergeDetections(localGames, remote);
          // Family sharing is optional and its token expires: a failure must not drop the owned sync.
          const ownedIds = new Set(owned.map((o) => o.storeId));
          const family = isValidSteamToken(steamToken)
            ? await fetchFamilySharedGames(steamId, steamToken).then((f) => f.filter((g) => !ownedIds.has(g.storeId)), (e) => { toast(`Família Steam: ${errorText(e)}`); return []; })
            : [];
          const merged = [...owned, ...family];
          const detection: ProviderDetection = {
            providerId: "steam",
            source: family.length ? "Steam Web API + Família Steam + appmanifest" : "Steam Web API + appmanifest",
            available: true,
            games: merged,
          };
          // The Web API lists the whole account: only the local manifests keep `installed` true.
          const items = planStoreImport("steam", detection.games, get().games).filter((i) => i.kind !== "same");
          if (items.length) get().importItems(items, { kind: "games", name: "Steam Web API" });
          if (family.length) set((s) => ({ games: tagFamilyGames(s.games, family) }));
          set((s) => ({
            providers: {
              ...s.providers,
              steam: { connected: true, lastSync: new Date().toISOString(), source: detection.source },
            },
          }));
          tasks.update(key, { progress: 100 });
          const familyNote = family.length ? `, ${family.length} da Família Steam` : "";
          toast(`Steam: ${owned.length} jogos na conta (${owned.filter((g) => g.installed).length} instalados${familyNote}).`);
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

      ...emulatorActions(set, get),
      ...psnActions(set, get),


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
        set(initialLibrary());
      },
    }),
    {
      name: "games-gallery:v1",
      storage: appStorage(),
      version: 4,
      migrate: migrateLibrary,
      partialize: ({ games, scans, providers, emulators, emulatorPaths, settings }) => ({ games, scans, providers, emulators, emulatorPaths, settings }),
      merge: (persisted, current) => mergeLibrary(persisted, current),
    },
  ),
);

/** Runs once the saved library is loaded (immediately in the browser, after the disk read in the app). */
export function whenHydrated(run: () => void): void {
  if (useLibrary.persist.hasHydrated()) return run();
  const off = useLibrary.persist.onFinishHydration(() => { off(); run(); });
}
