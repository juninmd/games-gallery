import { minutesByGame } from "../domain/playChart";
import type { PlaySession } from "../domain/sessions";
import { useSessions } from "./sessions";

let cache: { list: PlaySession[]; rows: Map<string, number[]> } | null = null;

/** Minutes per day for every game, computed once per sessions change and shared by all cards. */
export function usePlayRows(): Map<string, number[]> {
  const list = useSessions((s) => s.sessions);
  if (cache?.list !== list) cache = { list, rows: minutesByGame(list) };
  return cache.rows;
}
