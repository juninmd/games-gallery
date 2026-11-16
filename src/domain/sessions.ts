/** One play session. `minutes` is only known when the app spawned the process (emulators). */
export interface PlaySession {
  gameId: string;
  /** ISO start time. */
  start: string;
  minutes?: number;
  kind: "exec" | "uri";
}

export const MAX_SESSIONS = 2000;
/** A process alive longer than this was most likely left open, not played. */
export const MAX_SESSION_MINUTES = 12 * 60;

/** Whole minutes between two instants, clamped to [0, MAX]; a clock moved backwards counts as 0. */
export function sessionMinutes(startMs: number, endMs: number): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  const minutes = Math.round((endMs - startMs) / 60_000);
  return Math.min(Math.max(minutes, 0), MAX_SESSION_MINUTES);
}

/** Newest first, capped so `localStorage` stays bounded. */
export function appendSession(list: PlaySession[], session: PlaySession, cap = MAX_SESSIONS): PlaySession[] {
  return [session, ...list].slice(0, cap);
}

/** Distinct game ids, most recently played first. */
export function recentGameIds(list: PlaySession[], limit: number): string[] {
  const seen = new Set<string>();
  for (const s of list) {
    if (seen.size >= limit) break;
    seen.add(s.gameId);
  }
  return [...seen];
}

/** Hours to add to `Game.playtimeH`, rounded to one decimal like the rest of the UI. */
export const minutesToHours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

const ISO = /^\d{4}-\d{2}-\d{2}T/;

/** Drops anything malformed coming from storage or a backup file. */
export function sanitizeSessions(raw: unknown): PlaySession[] {
  if (!Array.isArray(raw)) return [];
  const out: PlaySession[] = [];
  for (const item of raw) {
    if (out.length >= MAX_SESSIONS) break;
    if (typeof item !== "object" || item === null) continue;
    const { gameId, start, minutes, kind } = item as Record<string, unknown>;
    if (typeof gameId !== "string" || !gameId || gameId.length > 200) continue;
    if (typeof start !== "string" || !ISO.test(start) || Number.isNaN(Date.parse(start))) continue;
    if (kind !== "exec" && kind !== "uri") continue;
    const okMinutes = typeof minutes === "number" && Number.isInteger(minutes) && minutes >= 0 && minutes <= MAX_SESSION_MINUTES;
    out.push(okMinutes ? { gameId, start, minutes, kind } : { gameId, start, kind });
  }
  return out;
}
