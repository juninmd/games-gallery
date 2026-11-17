import { create } from "zustand";
import { persist } from "zustand/middleware";
import { appendSession, minutesToHours, sanitizeSessions, sessionMinutes, type PlaySession } from "../domain/sessions";
import { onEmulatorExit } from "../platform/native";
import { appStorage } from "../platform/stateStorage";
import { useLibrary } from "./library";

interface Running {
  gameId: string;
  startMs: number;
}

interface SessionsState {
  sessions: PlaySession[];
  /** pid -> session in progress; only emulators report an exit (not persisted). */
  running: Record<number, Running>;
  /** A store URI was opened: the launcher owns the process, so only the start is known. */
  opened: (gameId: string, now?: number) => void;
  started: (gameId: string, pid: number, now?: number) => void;
  /** The emulator process ended: records the session and adds its time to the game. */
  finished: (pid: number, now?: number) => void;
  replace: (sessions: PlaySession[]) => void;
}

export const useSessions = create<SessionsState>()(
  persist(
    (set, get) => ({
      sessions: [],
      running: {},
      opened: (gameId, now = Date.now()) =>
        set((s) => ({ sessions: appendSession(s.sessions, { gameId, start: new Date(now).toISOString(), kind: "uri" }) })),
      started: (gameId, pid, now = Date.now()) => set((s) => ({ running: { ...s.running, [pid]: { gameId, startMs: now } } })),
      finished: (pid, now = Date.now()) => {
        const run = get().running[pid];
        if (!run) return;
        const minutes = sessionMinutes(run.startMs, now);
        const { [pid]: _done, ...running } = get().running;
        set((s) => ({
          running,
          sessions: appendSession(s.sessions, { gameId: run.gameId, start: new Date(run.startMs).toISOString(), minutes, kind: "exec" }),
        }));
        const game = useLibrary.getState().games.find((g) => g.id === run.gameId);
        const hours = minutesToHours(minutes);
        if (game && hours > 0) useLibrary.getState().patchGame(game.id, { playtimeH: Math.round((game.playtimeH + hours) * 10) / 10 });
      },
      replace: (sessions) => set({ sessions: sanitizeSessions(sessions) }),
    }),
    {
      name: "games-gallery:sessions:v1",
      storage: appStorage(),
      version: 1,
      partialize: ({ sessions }) => ({ sessions }),
      merge: (persisted, current) => ({
        ...current,
        sessions: sanitizeSessions(typeof persisted === "object" && persisted !== null ? (persisted as Record<string, unknown>)["sessions"] : undefined),
      }),
    },
  ),
);

/** Listens for emulator exits for the app's lifetime (installed app only). */
export function watchSessions(): Promise<() => void> {
  return onEmulatorExit(({ pid }) => useSessions.getState().finished(pid));
}
