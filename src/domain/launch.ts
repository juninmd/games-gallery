import { EMULATOR_BY_ID, defaultEmulator } from "./emulators";
import { PROVIDER_BY_ID } from "./providers";
import type { Emulator, Game } from "./types";

export type LaunchPlan =
  | { kind: "uri"; uri: string; preview: string }
  | { kind: "exec"; exe: string; args: string[]; preview: string }
  | { kind: "blocked"; reason: string };

export interface LaunchContext {
  /** emulatorId -> installed */
  installed: Record<string, boolean>;
}

const SAFE_STORE_ID = /^[\w.-]+$/;
// eslint-disable-next-line no-control-regex -- reject control chars in paths on purpose
const CONTROL_CHARS = /[\u0000-\u001f]/;

export function resolveEmulator(game: Game): Emulator | undefined {
  return (game.emulatorId && EMULATOR_BY_ID[game.emulatorId]) || defaultEmulator(game.platformId);
}

export function renderArgs(emulator: Emulator, platformId: string, rom: string): string[] {
  const core = emulator.cores?.[platformId];
  const coreArg = core ? `cores/${core}.dll` : "";
  // Function replacers: a string replacement would expand `$&`, `$$` etc. found in the path.
  return emulator.args.map((a) => a.replace("{rom}", () => rom).replace("{core}", () => coreArg));
}

const quote = (s: string) => (/\s/.test(s) ? `"${s}"` : s);

function planNative(game: Game): LaunchPlan {
  const provider = PROVIDER_BY_ID[game.providerId];
  if (!provider?.launchUri) {
    return { kind: "blocked", reason: `${provider?.name ?? "Provedor"} não expõe URI de launch; registre o executável do jogo.` };
  }
  if (!game.storeId || !SAFE_STORE_ID.test(game.storeId)) {
    return { kind: "blocked", reason: "ID da loja ausente ou inválido." };
  }
  const uri = provider.launchUri.replace("{id}", game.storeId);
  return { kind: "uri", uri, preview: uri };
}

function planEmulated(game: Game, ctx: LaunchContext): LaunchPlan {
  const emulator = resolveEmulator(game);
  if (!emulator) return { kind: "blocked", reason: "Nenhum emulador disponível para esta plataforma." };
  if (!ctx.installed[emulator.id]) {
    return { kind: "blocked", reason: `${emulator.name} não está instalado.` };
  }
  const rom = game.romPath?.trim();
  if (!rom || CONTROL_CHARS.test(rom)) {
    return { kind: "blocked", reason: "Caminho da ROM/ISO não definido." };
  }
  // A leading dash would be parsed as an emulator option by those without a `--` separator.
  if (rom.startsWith("-")) {
    return { kind: "blocked", reason: "Caminho da ROM não pode começar com “-”." };
  }
  const args = renderArgs(emulator, game.platformId, rom);
  return { kind: "exec", exe: emulator.exe, args, preview: [emulator.exe, ...args].map(quote).join(" ") };
}

export function planLaunch(game: Game, ctx: LaunchContext): LaunchPlan {
  if (!game.owned) return { kind: "blocked", reason: "Jogo na wishlist: ainda não é seu." };
  if (!game.installed) return { kind: "blocked", reason: "Jogo não instalado." };
  return game.platformId === "pc" ? planNative(game) : planEmulated(game, ctx);
}
