import { Star, Trash2, X } from "lucide-react";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "../domain/status";
import type { PlayStatus } from "../domain/types";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";
import { PlatformTag, ProviderTag } from "./Badges";
import { Cover } from "./Cover";
import { LaunchPanel } from "./LaunchPanel";
import { RatingsPanel } from "./RatingsPanel";
import { useNativeDialog } from "./useNativeDialog";

export function GameDrawer() {
  const { selectedId, select } = useUi();
  const game = useLibrary((s) => s.games.find((g) => g.id === selectedId));
  const { patchGame, removeGame } = useLibrary();
  const dialog = useNativeDialog(Boolean(game), () => select(null));

  const setStatus = (status: PlayStatus) => {
    if (!game) return;
    patchGame(game.id, status === "wishlist" ? { status, owned: false, installed: false } : { status, owned: true });
  };

  return (
    <dialog ref={dialog.ref} className="native-dialog drawer" aria-labelledby="game-drawer-title" onCancel={dialog.onCancel} onPointerDown={dialog.onPointerDown} onPointerUp={dialog.onPointerUp}>
      {game && <>
        <button className="icon-btn close" onClick={() => select(null)} aria-label="Fechar"><X size={18} /></button>
        <div className="drawer-hero">
          <div className="drawer-cover"><Cover game={game} /></div>
          <div>
            <h2 id="game-drawer-title">{game.title}</h2>
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
              <input type="number" min={0} max={1_000_000} value={game.playtimeH} onChange={(e) => {
                const value = e.currentTarget.valueAsNumber;
                patchGame(game.id, { playtimeH: Number.isFinite(value) ? Math.min(1_000_000, Math.max(0, value)) : 0 });
              }} />
            </label>
          </div>
        </section>

        <section className="panel game-notes">
          <label htmlFor="game-personal-notes">Notas pessoais</label>
          <textarea
            id="game-personal-notes"
            maxLength={5000}
            rows={4}
            value={game.notes ?? ""}
            aria-describedby="game-note-count"
            onChange={(e) => patchGame(game.id, { notes: e.currentTarget.value.slice(0, 5000) || undefined })}
            placeholder="Anotações sobre sua experiência, progresso ou configuração…"
          />
          <span id="game-note-count" className="muted small">{(game.notes ?? "").length}/5000</span>
        </section>

        <RatingsPanel game={game} />

        <LaunchPanel game={game} />

        <button className="btn ghost danger" onClick={() => { removeGame(game.id); select(null); }}>
          <Trash2 size={15} aria-hidden /> Remover da biblioteca
        </button>
      </>}
    </dialog>
  );
}
