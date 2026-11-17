import { useMemo } from "react";
import { hoursLeft, MAX_HOURS_TO_BEAT } from "../domain/backlogEstimate";
import { groupGames } from "../domain/duplicates";
import type { Game } from "../domain/types";
import { useLibrary } from "../state/library";

/** Manual "time to beat" (no public HowLongToBeat API) and how much is left, counting every store's hours. */
export function BeatEstimate({ game }: { game: Game }) {
  const games = useLibrary((s) => s.games);
  const patchGame = useLibrary((s) => s.patchGame);
  const group = useMemo(() => groupGames(games).find((g) => g.members.some((m) => m.id === game.id)), [games, game.id]);
  const left = group ? hoursLeft(group) : undefined;
  const beat = game.hoursToBeat;
  const progress = beat ? Math.min(100, Math.round(((beat - (left ?? beat)) / beat) * 100)) : 0;

  return (
    <div className="grid gap-2">
      <label className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-fog">Horas para terminar</span>
        <input
          type="number" min={0} max={MAX_HOURS_TO_BEAT} step={1}
          value={beat ?? ""}
          placeholder="ex.: 40"
          className="!w-24 !rounded-xl text-center tabular-nums"
          onChange={(e) => {
            const v = e.currentTarget.valueAsNumber;
            patchGame(game.id, { hoursToBeat: Number.isFinite(v) && v > 0 ? Math.min(MAX_HOURS_TO_BEAT, Math.round(v)) : undefined });
          }}
        />
      </label>
      {beat !== undefined && left !== undefined && (
        <>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso estimado">
            <div className="h-full rounded-full bg-aurora" style={{ width: `${progress}%` }} />
          </div>
          <p className="muted small">{left > 0 ? `Faltam cerca de ${left.toLocaleString("pt-BR")} h` : "Você já passou da estimativa"}</p>
        </>
      )}
    </div>
  );
}
