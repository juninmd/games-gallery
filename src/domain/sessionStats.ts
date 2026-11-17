import type { PlaySession } from "./sessions";

export interface YearSummary {
  year: number;
  /** Minutes played per month (local time), January first. */
  months: number[];
  minutes: number;
  sessions: number;
  daysPlayed: number;
  longest?: PlaySession;
  /** gameId -> minutes, most played first. */
  top: { gameId: string; minutes: number }[];
}

/** Only sessions with a measured length count toward time; store launches still count as days played. */
export function yearSummary(list: PlaySession[], year: number, top = 5): YearSummary {
  const months = Array.from({ length: 12 }, () => 0);
  const days = new Set<string>();
  const perGame = new Map<string, number>();
  let sessions = 0;
  let longest: PlaySession | undefined;
  for (const s of list) {
    const d = new Date(s.start);
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== year) continue;
    sessions += 1;
    days.add(`${d.getMonth()}-${d.getDate()}`);
    const m = s.minutes ?? 0;
    months[d.getMonth()]! += m;
    perGame.set(s.gameId, (perGame.get(s.gameId) ?? 0) + m);
    if (m > (longest?.minutes ?? 0)) longest = s;
  }
  const ranked = [...perGame].filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]).slice(0, top).map(([gameId, minutes]) => ({ gameId, minutes }));
  return { year, months, minutes: months.reduce((a, b) => a + b, 0), sessions, daysPlayed: days.size, longest, top: ranked };
}
