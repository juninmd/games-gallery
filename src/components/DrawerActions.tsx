import { Download, Play, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Game } from "../domain/types";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";
import { ProgressBar } from "./Badges";
import type { LaunchState } from "./useLaunch";

/** Sticky footer: the one action that matters for the game's current state, plus uninstall and remove. */
export function DrawerActions({ game, launch }: { game: Game; launch: LaunchState }) {
  const patchGame = useLibrary((s) => s.patchGame);
  const installGame = useLibrary((s) => s.installGame);
  const uninstallGame = useLibrary((s) => s.uninstallGame);
  const removeGame = useLibrary((s) => s.removeGame);
  const select = useUi((s) => s.select);
  const { plan, task, play } = launch;
  const [confirming, setConfirming] = useState(false);
  const isPc = game.platformId === "pc";

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3500);
    return () => clearTimeout(t);
  }, [confirming]);

  const primary = "group relative flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-signature px-5 py-3 text-[15px] font-semibold text-white shadow-glow transition-all duration-300 ease-expo hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

  return (
    <footer className="sticky bottom-0 z-10 mt-auto grid gap-3 border-t border-white/10 bg-ink-900/85 px-6 py-4 backdrop-blur-xl">
      {task && <ProgressBar value={task.progress} label={task.label} />}
      <div className="flex items-center gap-2.5">
        {!game.owned ? (
          <button className={primary} onClick={() => patchGame(game.id, { owned: true, status: "backlog" })}>Marcar como comprado</button>
        ) : game.installed ? (
          <button className={primary} onClick={play} disabled={plan.kind === "blocked"}>
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-sheen bg-white/25 blur-md" />
            <Play size={18} aria-hidden className="relative fill-current" /> <span className="relative">Jogar</span>
          </button>
        ) : (
          <button className={primary} disabled={!!task} onClick={() => installGame(game.id)}>
            <Download size={18} aria-hidden /> {task ? `${Math.round(task.progress)}%` : isPc ? "Instalar" : "Preparar jogo"}
          </button>
        )}
        {game.installed && (
          <button type="button" className="icon-btn !size-12 !rounded-2xl" onClick={() => uninstallGame(game.id)} aria-label="Desinstalar" title="Desinstalar">
            <Download size={17} className="rotate-180" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={() => { if (confirming) { removeGame(game.id); select(null); } else setConfirming(true); }}
          aria-label={confirming ? "Confirmar remoção da biblioteca" : "Remover da biblioteca"}
          title={confirming ? "Clique de novo para confirmar" : "Remover da biblioteca"}
          className={`flex h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition-all duration-300 ease-expo ${confirming ? "border-bad/60 bg-bad/15 px-4 text-bad" : "w-12 border-white/10 bg-white/[0.06] text-fog hover:border-bad/50 hover:text-bad"}`}
        >
          <Trash2 size={17} aria-hidden /> {confirming && "Remover?"}
        </button>
      </div>
      {plan.kind === "blocked" && game.installed && <p className="m-0 text-xs text-warn">{plan.reason}</p>}
    </footer>
  );
}
