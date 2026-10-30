import { Clock, Dices } from "lucide-react";
import { useMemo } from "react";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";
import { Cover } from "./Cover";

/** The game in progress, or a nudge toward the backlog when nothing is. */
export function NowPlaying() {
  const games = useLibrary((s) => s.games);
  const select = useUi((s) => s.select);
  const go = useUi((s) => s.go);
  const playing = useMemo(
    () => games.filter((g) => g.status === "playing").sort((a, b) => b.playtimeH - a.playtimeH || a.title.localeCompare(b.title)).slice(0, 1),
    [games],
  );

  const pickRandom = () => {
    const pool = games.filter((g) => g.status === "backlog" && g.owned);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) select(pick.id); else go("board");
  };

  return (
    <section aria-label="Jogando agora" className="glass grid gap-2 rounded-2xl p-2.5 [@media(max-height:800px)]:hidden">
      <h2 className="flex items-center gap-2 px-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-fog/80">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-aurora/70" />
          <span className="relative inline-flex size-2 rounded-full bg-aurora" />
        </span>
        Jogando agora
      </h2>
      {playing.length === 0 ? (
        <p className="px-1 text-xs text-fog">Nada em andamento.</p>
      ) : (
        <ul className="m-0 grid list-none gap-1 p-0">
          {playing.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => select(g.id)}
                className="group flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors hover:bg-white/[0.07]"
                aria-label={`Abrir ${g.title}`}
              >
                <div className="w-9 shrink-0 transition-transform duration-300 ease-expo group-hover:-rotate-3 group-hover:scale-105"><Cover game={g} /></div>
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-semibold text-mist">{g.title}</div>
                  <div className="flex items-center gap-1 text-[11px] text-fog"><Clock size={11} aria-hidden /> {g.playtimeH.toLocaleString("pt-BR")} h</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={pickRandom}
        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-2 text-xs font-semibold text-mist transition-all duration-300 ease-expo hover:border-rose/50 hover:bg-rose/10 active:scale-95"
      >
        <Dices size={14} aria-hidden /> Sortear do backlog
      </button>
    </section>
  );
}
