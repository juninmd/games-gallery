import { hasGametdbScans, ROM_SERIAL } from "../domain/gametdb";
import type { Game } from "../domain/types";
import { nativeAvailable, romSerial } from "../platform/native";
import { useLibrary } from "./library";

type Read = (path: string) => Promise<string | null>;

/** Tried this session (found or not): a file without an ID is not re-read on every import. */
const tried = new Set<string>();

export const needsSerial = (g: Game) =>
  hasGametdbScans(g.platformId) && !g.romSerial && Boolean(g.romPath?.trim()) && !/\.(zip|7z|rar)$/i.test(g.romPath!.trim()) && !tried.has(g.id);

/** Reads the header ID of GameCube/Wii/3DS ROMs that have none yet; one file at a time, a few KB each. */
export async function readRomSerials(read: Read = romSerial): Promise<number> {
  let found = 0;
  for (const game of useLibrary.getState().games.filter(needsSerial)) {
    tried.add(game.id);
    try {
      const id = await read(game.romPath!.trim());
      if (id && ROM_SERIAL.test(id)) {
        useLibrary.getState().patchGame(game.id, { romSerial: id });
        found += 1;
      }
    } catch {
      // Unreadable or moved file: the box keeps its generated art.
    }
  }
  return found;
}

/** Background pass when the native app is running; never throws. */
export function readRomSerialsSoon() {
  if (nativeAvailable()) void readRomSerials().catch(() => undefined);
}

export const resetSerialAttempts = () => tried.clear();
