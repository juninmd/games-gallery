import { ProgressBar, TextField } from "@juninmd/sonido";
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
      <TextField
        compact label="Horas para terminar" className="beat-field"
        type="number" min={0} max={MAX_HOURS_TO_BEAT} step={1}
        value={beat ?? ""}
        placeholder="ex.: 40"
        onChange={(e) => {
          const v = e.currentTarget.valueAsNumber;
          patchGame(game.id, { hoursToBeat: Number.isFinite(v) && v > 0 ? Math.min(MAX_HOURS_TO_BEAT, Math.round(v)) : undefined });
        }}
      />
      {beat !== undefined && left !== undefined && (
        <>
          <ProgressBar size="sm" tone="aqua" value={progress / 100} label="Progresso estimado" />
          <p className="muted small">{left > 0 ? `Faltam cerca de ${left.toLocaleString("pt-BR")} h` : "Você já passou da estimativa"}</p>
        </>
      )}
    </div>
  );
}
