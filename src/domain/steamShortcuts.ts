import { planLaunch, type LaunchContext } from "./launch";
import type { Game } from "./types";

export interface ShortcutEntry { name: string; exe: string; args: string[] }

const ABSOLUTE = /^([A-Za-z]:[\\/]|\/)/;

/** Emulated games that launch right now with an emulator found on disk (absolute path), one shortcut each. */
export function shortcutEntries(games: Game[], ctx: LaunchContext): ShortcutEntry[] {
  return games.flatMap((game) => {
    if (game.platformId === "pc") return [];
    const plan = planLaunch(game, ctx);
    // Steam's command line has no escape for quotes, so such titles/paths are left out.
    if (plan.kind !== "exec" || !ABSOLUTE.test(plan.exe) || [game.title, plan.exe, ...plan.args].some((s) => s.includes('"'))) return [];
    return [{ name: game.title.trim(), exe: plan.exe, args: plan.args }];
  });
}
