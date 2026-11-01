import { Check, Download, Gift } from "lucide-react";
import { useMemo } from "react";
import { groupGames } from "../domain/duplicates";
import { PROVIDER_BY_ID } from "../domain/providers";
import type { Game } from "../domain/types";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

function copyState(g: Game) {
  if (g.installed) return { label: "Instalado", icon: <Check size={12} aria-hidden />, tone: "text-aurora" };
  if (g.owned) return { label: "Na conta", icon: <Download size={12} aria-hidden />, tone: "text-fog" };
  return { label: "Wishlist", icon: <Gift size={12} aria-hidden />, tone: "text-ember" };
}

/** Every store that owns this game. Picking one switches the drawer to that copy (and its launch/install). */
export function StoresPanel({ game }: { game: Game }) {
  const games = useLibrary((s) => s.games);
  const select = useUi((s) => s.select);
  const patchGame = useLibrary((s) => s.patchGame);
  const members = useMemo(() => groupGames(games).find((x) => x.members.some((m) => m.id === game.id))?.members ?? [game], [games, game]);
  // A separated copy has no group; offer to merge back only when a same-title copy exists elsewhere.
  const canMergeBack = useMemo(
    () => Boolean(game.separate) && groupGames(games.map((g) => (g.id === game.id ? { ...g, separate: undefined } : g))).some((x) => x.members.length > 1 && x.members.some((m) => m.id === game.id)),
    [games, game],
  );
  if (game.separate) {
    return canMergeBack ? (
      <section className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" aria-label="Cópia separada">
        <span className="text-sm text-fog">Esta cópia foi separada: não é unida a outras lojas com o mesmo nome.</span>
        <button type="button" className="btn" onClick={() => patchGame(game.id, { separate: undefined })}>Unificar de novo</button>
      </section>
    ) : null;
  }
  if (members.length < 2) return null;
  const totalHours = members.reduce((s, m) => s + m.playtimeH, 0);

  return (
    <section className="glass grid gap-3 rounded-2xl p-4" aria-label="Lojas deste jogo">
      <div className="flex items-baseline justify-between gap-3">
        <h3>Em {members.length} lojas</h3>
        <span className="text-xs text-fog tabular-nums">{totalHours > 0 ? `${totalHours} h no total` : "Unificado pelo título"}</span>
      </div>
      <ul className="m-0 grid list-none gap-2 p-0">
        {members.map((m) => {
          const p = PROVIDER_BY_ID[m.providerId];
          const st = copyState(m);
          const current = m.id === game.id;
          return (
            <li key={m.id} className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => select(m.id)}
                aria-current={current ? "true" : undefined}
                className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ease-expo hover:-translate-y-0.5 ${current ? "border-white/25 bg-white/[0.08]" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}
              >
                <i className="size-3 shrink-0 rounded-full" style={{ background: p?.color ?? "#777" }} aria-hidden />
                <span className="min-w-0 flex-1 truncate font-semibold text-mist">{p?.name ?? m.providerId}</span>
                {m.playtimeH > 0 && <span className="text-xs tabular-nums text-fog">{m.playtimeH} h</span>}
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${st.tone}`}>{st.icon}{st.label}</span>
              </button>
              {!current && (
                <button
                  type="button"
                  className="shrink-0 rounded-xl border border-white/10 px-3 text-xs font-semibold text-fog transition-colors hover:border-ember/60 hover:text-ember"
                  title="Marcar esta cópia como outro jogo (mesmo nome, jogo diferente)"
                  aria-label={`Separar ${p?.name ?? m.providerId}: não é o mesmo jogo`}
                  onClick={() => patchGame(m.id, { separate: true })}
                >
                  Não é o mesmo
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
