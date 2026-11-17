import type { Game } from "../domain/types";
import { findSgdbCover, type GetJsonWithHeaders } from "../platform/steamGridDb";
import { useLibrary } from "./library";
import { useSecrets } from "./secrets";
import { useTasks } from "./tasks";

/** One run stays well under SteamGridDB's rate limits and finishes in a couple of minutes. */
export const MAX_COVERS_PER_RUN = 100;
const TASK = "covers:sgdb";

/** Games that still show a generated cover. */
export const missingCovers = (games: Game[]) => games.filter((g) => !g.coverUrl);

/** Looks up one game's cover; returns whether it changed. */
export async function fetchCoverFor(gameId: string, get?: GetJsonWithHeaders): Promise<boolean> {
  const game = useLibrary.getState().games.find((g) => g.id === gameId);
  if (!game) return false;
  const url = await findSgdbCover(useSecrets.getState().sgdbKey, game, get);
  if (!url || url === game.coverUrl) return false;
  useLibrary.getState().patchGame(game.id, { coverUrl: url });
  return true;
}

/** Fills generated covers from SteamGridDB, one request chain at a time; cancelable from the task list. */
export async function fetchMissingCovers(get?: GetJsonWithHeaders): Promise<{ found: number; tried: number }> {
  const queue = missingCovers(useLibrary.getState().games).slice(0, MAX_COVERS_PER_RUN);
  const tasks = useTasks.getState();
  tasks.start(TASK, "Buscando capas no SteamGridDB");
  let found = 0;
  let tried = 0;
  try {
    for (const game of queue) {
      if (!useTasks.getState().tasks[TASK]) break;
      tried += 1;
      // A single title failing (404, no match) must not stop the run.
      if (await fetchCoverFor(game.id, get).catch(() => false)) found += 1;
      tasks.update(TASK, { progress: Math.round((tried / queue.length) * 100), detail: `${found} de ${tried}` });
    }
  } finally {
    useTasks.getState().done(TASK);
  }
  return { found, tried };
}
