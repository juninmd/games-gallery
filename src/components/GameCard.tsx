import { memo, useRef, type CSSProperties, type PointerEvent } from "react";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { PROVIDER_BY_ID } from "../domain/providers";
import type { Game } from "../domain/types";
import { useTasks } from "../state/tasks";
import { useUi } from "../state/ui";
import { ProgressBar } from "./Badges";
import { Cover } from "./Cover";
import { EmulatorChip } from "./EmulatorChip";

const MAX_TILT = 9;
const canTilt = () =>
  typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const GameCard = memo(function GameCard({ game, index = 0 }: { game: Game; index?: number }) {
  const select = useUi((s) => s.select);
  const task = useTasks((s) => s.tasks[`game:${game.id}`]);
  const tilt = useRef<HTMLDivElement>(null);

  // Writes CSS variables straight to the node: no React re-render per pointer move.
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const node = tilt.current;
    if (!node || !canTilt()) return;
    const r = node.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    node.style.setProperty("--mx", `${x * 100}%`);
    node.style.setProperty("--my", `${y * 100}%`);
    node.style.setProperty("--rx", `${((0.5 - y) * MAX_TILT).toFixed(2)}deg`);
    node.style.setProperty("--ry", `${((x - 0.5) * MAX_TILT).toFixed(2)}deg`);
  };
  const onLeave = () => {
    const node = tilt.current;
    if (!node) return;
    node.style.setProperty("--rx", "0deg");
    node.style.setProperty("--ry", "0deg");
  };

  return (
    <button
      className="group relative grid animate-card-in gap-3 text-left focus-visible:outline-none"
      style={{ animationDelay: `${Math.min(index, 18) * 28}ms` } as CSSProperties}
      onClick={() => select(game.id)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      aria-label={`Abrir ${game.title}`}
    >
      <div
        ref={tilt}
        className="relative transition-transform duration-300 ease-expo will-change-transform [transform:perspective(800px)_rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))_scale(1)] group-hover:[transform:perspective(800px)_rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))_translateY(-6px)_scale(1.03)] group-focus-visible:-translate-y-1.5"
      >
        <Cover game={game} />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[18px] opacity-0 mix-blend-soft-light transition-opacity duration-300 group-hover:opacity-100 [background:radial-gradient(260px_circle_at_var(--mx,50%)_var(--my,50%),rgb(255_255_255/0.5),transparent_60%)]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[18px] opacity-0 ring-1 ring-inset ring-rose/70 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 group-focus-visible:ring-2"
        />
        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {game.installed && (
            <span className="rounded-full bg-aurora/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-950 shadow-lg backdrop-blur">Instalado</span>
          )}
          {!game.owned && (
            <span className="rounded-full bg-ember/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-950 shadow-lg backdrop-blur">Wishlist</span>
          )}
        </div>
        {task && <div className="absolute inset-x-2.5 bottom-2.5"><ProgressBar value={task.progress} label={task.label} /></div>}
      </div>
      <div className="grid min-w-0 gap-0.5 px-0.5">
        <strong className="truncate font-display text-[14px] font-semibold tracking-tight text-mist" title={game.title}>{game.title}</strong>
        <span className="text-[11.5px] text-fog">
          {PLATFORM_BY_ID[game.platformId]?.short} · {PROVIDER_BY_ID[game.providerId]?.name}
        </span>
        <EmulatorChip game={game} />
      </div>
    </button>
  );
});
