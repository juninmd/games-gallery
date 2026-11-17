import { EMULATOR_BY_ID, EMULATORS } from "../domain/emulators";
import { commandsFor, hostOs } from "../domain/install";
import {
  detectEmulators,
  emulatorCancel,
  emulatorInstall,
  emulatorUninstall,
  nativeAvailable,
  onEmulatorOutput,
  type InstallRequest,
} from "../platform/native";
import { isTauri } from "../platform/runtime";
import type { LibraryState } from "./library";
import { useTasks } from "./tasks";
import { useUi } from "./ui";

type Set = (fn: (s: LibraryState) => Partial<LibraryState>) => void;
type Get = () => LibraryState;
type EmulatorActions = Pick<LibraryState, "installEmulator" | "uninstallEmulator" | "cancelEmulator" | "refreshEmulators">;

const toast = (msg: string) => useUi.getState().toast(msg);
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const MANAGER_FOR_OS = { windows: "winget", macos: "brew", linux: "flatpak" } as const;

/** Package-manager install/uninstall and on-disk detection of emulators (real commands, streamed output). */
export const emulatorActions = (set: Set, get: Get): EmulatorActions => ({
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
});
