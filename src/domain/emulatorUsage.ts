import { resolveEmulator } from "./launch";
import type { Game } from "./types";

export interface EmulatorUsage {
  /** Owned or wishlisted games that resolve to this emulator. */
  games: Game[];
  /** Owned, marked installed and with a ROM path: can be launched once the emulator is installed. */
  ready: number;
}

/** emulatorId -> games that use it (explicit choice or platform default). PC games never emulate. */
export function emulatorUsage(games: Game[]): Record<string, EmulatorUsage> {
  const out: Record<string, EmulatorUsage> = {};
  for (const g of games) {
    if (g.platformId === "pc") continue;
    const id = resolveEmulator(g)?.id;
    if (!id) continue;
    const u = (out[id] ??= { games: [], ready: 0 });
    u.games.push(g);
    if (g.owned && g.installed && g.romPath?.trim()) u.ready++;
  }
  return out;
}
