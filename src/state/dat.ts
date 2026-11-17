import { create } from "zustand";
import { CRC32, parseDat, type DatIndex } from "../domain/dat";
import type { Game } from "../domain/types";
import { romCrc32 } from "../platform/native";
import { useLibrary } from "./library";
import { useTasks } from "./tasks";

/** Hashing reads whole files (ISOs can be GBs): one run is bounded and cancelable. */
export const MAX_ROMS_PER_RUN = 300;
const TASK = "roms:crc";

type Hash = (path: string) => Promise<string>;

interface DatState {
  /** Kept in memory only: the DAT stays the user's file, re-loaded when needed. */
  index: DatIndex;
  source: string;
  load: (text: string, source: string) => number;
}

export const useDat = create<DatState>()((set) => ({
  index: new Map(),
  source: "",
  load: (text, source) => {
    const index = parseDat(text);
    set({ index, source });
    return index.size;
  },
}));

/** ROMs that can be hashed: a real path, not compressed (the DAT lists the uncompressed file). */
export const hashable = (games: Game[]) =>
  games.filter((g) => g.platformId !== "pc" && g.romPath?.trim() && !/\.(zip|7z|rar)$/i.test(g.romPath.trim()));

/** Hashes one game's ROM and records the DAT name when the CRC is listed. */
export async function identifyRom(gameId: string, hash: Hash = romCrc32): Promise<"match" | "nomatch"> {
  const game = useLibrary.getState().games.find((g) => g.id === gameId);
  if (!game?.romPath?.trim()) throw new Error("Caminho da ROM não definido.");
  const crc = (await hash(game.romPath.trim())).toUpperCase();
  if (!CRC32.test(crc)) throw new Error("CRC32 inválido");
  const datName = useDat.getState().index.get(crc);
  useLibrary.getState().patchGame(game.id, { romCrc32: crc, datName });
  return datName ? "match" : "nomatch";
}

/** Hashes ROMs not hashed yet (or all with `force`), one at a time; a failing file does not stop the run. */
export async function identifyRoms(hash: Hash = romCrc32, force = false): Promise<{ matched: number; hashed: number; failed: number }> {
  const { index } = useDat.getState();
  // Already hashed: a newly loaded DAT only needs a lookup, not another full read of the file.
  for (const g of hashable(useLibrary.getState().games)) {
    const name = g.romCrc32 ? index.get(g.romCrc32) : undefined;
    if (!force && name && name !== g.datName) useLibrary.getState().patchGame(g.id, { datName: name });
  }
  const queue = hashable(useLibrary.getState().games).filter((g) => force || !g.romCrc32).slice(0, MAX_ROMS_PER_RUN);
  const tasks = useTasks.getState();
  tasks.start(TASK, "Calculando CRC32 das ROMs");
  const out = { matched: 0, hashed: 0, failed: 0 };
  try {
    for (const [i, game] of queue.entries()) {
      if (!useTasks.getState().tasks[TASK]) break;
      try {
        if ((await identifyRom(game.id, hash)) === "match") out.matched += 1;
        out.hashed += 1;
      } catch {
        out.failed += 1;
      }
      tasks.update(TASK, { progress: Math.round(((i + 1) / queue.length) * 100), detail: game.title });
    }
  } finally {
    useTasks.getState().done(TASK);
  }
  return out;
}
