import { Play } from "lucide-react";
import { memo, useRef, type CSSProperties, type PointerEvent } from "react";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { PROVIDER_BY_ID } from "../domain/providers";
import type { Game } from "../domain/types";
import { StoreChips } from "./StoreChips";
import { useUi } from "../state/ui";
import { Cover } from "./Cover";
import { EmulatorChip } from "./EmulatorChip";
import { ambientFor, openGame } from "./shell/ambient";
import { useLaunch } from "./useLaunch";

const MAX_TILT = 9;
const canTilt = () =>
  typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Play straight from the card, without opening the detail page. */
function QuickPlay({ game }: { game: Game }) {
  const { plan, play } = useLaunch(game);
  if (plan.kind === "blocked") return null;
  return (
    <button type="button" className="quick-play" onClick={() => void play()} aria-label={`Jogar ${game.title}`} title="Jogar">
      <Play size={16} className="fill-current" aria-hidden />
    </button>
  );
}

export const GameCard = memo(function GameCard({ game, members = [game], index = 0 }: { game: Game; members?: Game[]; index?: number }) {
  const setAmbient = useUi((s) => s.setAmbient);
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

  const playable = game.installed && game.owned;

  return (
    <div className="game-card relative" onPointerEnter={() => setAmbient(ambientFor(game))}>
    <button
      className="group relative grid w-full animate-card-in gap-3 text-left focus-visible:outline-none"
      style={{ animationDelay: `${Math.min(index, 18) * 28}ms` } as CSSProperties}
      onClick={() => openGame(game.id, tilt.current?.querySelector<HTMLElement>(".cover"))}
      onFocus={() => setAmbient(ambientFor(game))}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      aria-label={members.length > 1 ? `Abrir ${game.title}, em ${members.length} lojas` : `Abrir ${game.title}`}
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
        {members.length > 1 && (
          <span className="absolute bottom-2.5 right-2.5 rounded-full bg-ink-950/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-mist shadow-lg ring-1 ring-white/20 backdrop-blur">
            {members.length} lojas
          </span>
        )}
        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {game.installed && (
            <span className="rounded-full bg-aurora/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-950 shadow-lg backdrop-blur">Instalado</span>
          )}
          {!game.owned && (
            <span className="rounded-full bg-ember/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-950 shadow-lg backdrop-blur">Wishlist</span>
          )}
        </div>
      </div>
      <div className="grid min-w-0 gap-0.5 px-0.5">
        <strong className="truncate font-display text-[14px] font-semibold tracking-tight text-mist" title={game.title}>{game.title}</strong>
        {members.length > 1 ? (
          <StoreChips members={members} />
        ) : (
          <span className="text-[11.5px] text-fog">
            {PLATFORM_BY_ID[game.platformId]?.short} · {PROVIDER_BY_ID[game.providerId]?.name}
          </span>
        )}
        <EmulatorChip game={game} />
      </div>
    </button>
    {playable && <QuickPlay game={game} />}
    </div>
  );
});
