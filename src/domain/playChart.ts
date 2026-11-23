import type { PlaySession } from "./sessions";

/** Days shown in a card's mini chart, oldest first, ending today. */
export const CHART_DAYS = 14;

const DAY_MS = 86_400_000;
const localDay = (ms: number) => {
  const d = new Date(ms);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS;
};

/** gameId -> measured minutes per local day over the last `days` days (today last). One pass over the sessions. */
export function minutesByGame(list: PlaySession[], now = Date.now(), days = CHART_DAYS): Map<string, number[]> {
  const today = localDay(now);
  const out = new Map<string, number[]>();
  for (const s of list) {
    if (!s.minutes) continue;
    const start = Date.parse(s.start);
    if (Number.isNaN(start)) continue;
    const slot = days - 1 - (today - localDay(start));
    if (slot < 0 || slot >= days) continue;
    let row = out.get(s.gameId);
    if (!row) out.set(s.gameId, (row = Array.from({ length: days }, () => 0)));
    row[slot]! += s.minutes;
  }
  return out;
}

/** Sums the rows of every store copy of one game; undefined when none was played in the window. */
export function mergeRows(rows: (number[] | undefined)[]): number[] | undefined {
  const present = rows.filter((r): r is number[] => Boolean(r));
  if (!present.length) return undefined;
  return present[0]!.map((_, i) => present.reduce((sum, r) => sum + (r[i] ?? 0), 0));
}
