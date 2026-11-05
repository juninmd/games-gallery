import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addEntries, dayOf, diffPlaytime, sanitizeLog, type Delta, type PlayEntry } from "../domain/playLog";
import type { Game } from "../domain/types";
import { useLibrary } from "./library";
import { isQuiet } from "./playLogGate";

interface PlayLogState {
  log: PlayEntry[];
  add: (deltas: Delta[], now?: number) => void;
  replace: (log: PlayEntry[]) => void;
  clear: () => void;
}

export const usePlayLog = create<PlayLogState>()(
  persist(
    (set) => ({
      log: [],
      add: (deltas, now = Date.now()) => set((s) => ({ log: addEntries(s.log, deltas, dayOf(now)) })),
      replace: (log) => set({ log: sanitizeLog(log) }),
      clear: () => set({ log: [] }),
    }),
    {
      name: "games-gallery:playlog:v1",
      version: 1,
      partialize: ({ log }) => ({ log }),
      merge: (persisted, current) => ({
        ...current,
        log: sanitizeLog(typeof persisted === "object" && persisted !== null ? (persisted as Record<string, unknown>)["log"] : undefined),
      }),
    },
  ),
);

const snapshot = (games: Game[]) => new Map(games.map((g) => [g.id, g.playtimeH]));

/** Starts recording growth in play time. Call once, after the library is loaded. Returns the unsubscribe. */
export function watchPlayLog(): () => void {
  let prev = snapshot(useLibrary.getState().games);
  return useLibrary.subscribe((s, before) => {
    if (s.games === before.games) return;
    if (isQuiet()) { prev = snapshot(s.games); return; }
    const { deltas, next } = diffPlaytime(prev, s.games);
    prev = next;
    if (deltas.length) usePlayLog.getState().add(deltas);
  });
}
