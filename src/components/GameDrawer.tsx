import { Star, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "../domain/status";
import type { PlayStatus } from "../domain/types";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";
import { PlatformTag, ProviderTag } from "./Badges";
import { Cover } from "./Cover";
import { LaunchPanel } from "./LaunchPanel";
import { RatingsPanel } from "./RatingsPanel";

export function GameDrawer() {
  const { selectedId, select } = useUi();
  const game = useLibrary((s) => s.games.find((g) => g.id === selectedId));
  const { patchGame, removeGame } = useLibrary();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && select(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  if (!game) return null;

  const setStatus = (status: PlayStatus) =>
    patchGame(game.id, status === "wishlist" ? { status, owned: false, installed: false } : { status, owned: true });

  return (
    <>
      <div className="scrim" onClick={() => select(null)} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={game.title}>
        <button className="icon-btn close" onClick={() => select(null)} aria-label="Fechar"><X size={18} /></button>
        <div className="drawer-hero">
          <div className="drawer-cover"><Cover game={game} /></div>
          <div>
            <h2>{game.title}</h2>
            <p className="muted">{[game.year || null, game.genres.join(" · ") || null].filter(Boolean).join(" · ") || "Sem metadados"}</p>
            <div className="tags"><PlatformTag id={game.platformId} /><ProviderTag id={game.providerId} /></div>
            <p className="muted small">{PLATFORM_BY_ID[game.platformId]?.name}{game.sizeGb ? ` · ${game.sizeGb} GB` : ""}</p>
          </div>
        </div>

        <section className="panel">
          <h3>Status</h3>
          <div className="seg" role="radiogroup" aria-label="Status do jogo">
            {STATUS_ORDER.map((s) => (
              <button key={s} role="radio" aria-checked={game.status === s} className={game.status === s ? "on" : ""} style={{ "--c": STATUS_COLOR[s] } as React.CSSProperties} onClick={() => setStatus(s)}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="row">
            <div className="stars" role="group" aria-label="Avaliação">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} aria-label={`${n} estrela${n > 1 ? "s" : ""}`} aria-pressed={(game.rating ?? 0) >= n} className={(game.rating ?? 0) >= n ? "on" : ""} onClick={() => patchGame(game.id, { rating: game.rating === n ? undefined : n })}>
                  <Star size={18} fill={(game.rating ?? 0) >= n ? "currentColor" : "none"} />
                </button>
              ))}
            </div>
            <label className="hours">
              Horas jogadas
              <input type="number" min={0} value={game.playtimeH} onChange={(e) => patchGame(game.id, { playtimeH: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
          </div>
        </section>

        <RatingsPanel game={game} />

        <LaunchPanel game={game} />

        <button className="btn ghost danger" onClick={() => { removeGame(game.id); select(null); }}>
          <Trash2 size={15} aria-hidden /> Remover da biblioteca
        </button>
      </aside>
    </>
  );
}
