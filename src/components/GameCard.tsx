import { memo, type CSSProperties } from "react";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { PROVIDER_BY_ID } from "../domain/providers";
import type { Game } from "../domain/types";
import { useTasks } from "../state/tasks";
import { useUi } from "../state/ui";
import { ProgressBar } from "./Badges";
import { Cover } from "./Cover";
import { EmulatorChip } from "./EmulatorChip";

export const GameCard = memo(function GameCard({ game, index = 0 }: { game: Game; index?: number }) {
  const select = useUi((s) => s.select);
  const task = useTasks((s) => s.tasks[`game:${game.id}`]);

  return (
    <button className="card" style={{ "--i": index } as CSSProperties} onClick={() => select(game.id)} aria-label={`Abrir ${game.title}`}>
      <Cover game={game} />
      {game.installed && <span className="flag flag-installed">Instalado</span>}
      {!game.owned && <span className="flag flag-wish">Wishlist</span>}
      {task && <ProgressBar value={task.progress} label={task.label} />}
      <div className="card-meta">
        <strong title={game.title}>{game.title}</strong>
        <span>
          {PLATFORM_BY_ID[game.platformId]?.short} · {PROVIDER_BY_ID[game.providerId]?.name}
        </span>
        <EmulatorChip game={game} />
      </div>
    </button>
  );
});
