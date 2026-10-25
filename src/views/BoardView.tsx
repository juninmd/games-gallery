import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Cover } from "../components/Cover";
import { PlatformTag } from "../components/Badges";
import { createGameQueryMatcher } from "../domain/filter";
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "../domain/status";
import type { Game, PlayStatus } from "../domain/types";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";
import "../styles/board.css";

function BoardCard({ game, onMove, registerStatusSelect }: {
  game: Game;
  onMove: (game: Game, status: PlayStatus) => void;
  registerStatusSelect: (id: string, node: HTMLSelectElement | null) => void;
}) {
  const select = useUi((s) => s.select);
  return (
    <article
      className="bcard"
      data-game-id={game.id}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", game.id); e.dataTransfer.effectAllowed = "move"; }}
    >
      <button className="bcard-cover-open" aria-label={`Abrir detalhes de ${game.title}`} onClick={() => select(game.id)}>
        <div className="bcover"><Cover game={game} /></div>
      </button>
      <div className="bcard-main">
        <button className="bcard-title" onClick={() => select(game.id)}>{game.title}</button>
        <div className="tags"><PlatformTag id={game.platformId} />{game.installed && <span className="tag ok">instalado</span>}</div>
        <label className="bcard-status-label" htmlFor={`board-status-${game.id}`}>Status de {game.title}</label>
        <select
          ref={(node) => registerStatusSelect(game.id, node)}
          id={`board-status-${game.id}`}
          className="bcard-status"
          value={game.status}
          aria-label={`Status de ${game.title}`}
          onChange={(e) => onMove(game, e.target.value as PlayStatus)}
          onDragStart={(e) => e.stopPropagation()}
        >
          {STATUS_ORDER.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
        </select>
      </div>
    </article>
  );
}

export function BoardView() {
  const games = useLibrary((s) => s.games);
  const patchGame = useLibrary((s) => s.patchGame);
  const [over, setOver] = useState<PlayStatus | null>(null);
  const [query, setQuery] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const statusSelects = useRef(new Map<string, HTMLSelectElement>());
  const focusAfterMove = useRef<string | null>(null);

  const grouped = useMemo(() => {
    const result: Record<PlayStatus, Game[]> = { playing: [], backlog: [], completed: [], dropped: [], wishlist: [] };
    const matchesQuery = createGameQueryMatcher(query);
    for (const game of games) if (matchesQuery(game)) result[game.status].push(game);
    return result;
  }, [games, query]);

  useLayoutEffect(() => {
    const id = focusAfterMove.current;
    if (!id) return;
    const select = statusSelects.current.get(id);
    if (select) {
      focusAfterMove.current = null;
      select.focus();
    }
  }, [games]);

  const move = (game: Game, status: PlayStatus, restoreFocus = false) => {
    if (game.status === status) return;
    if (restoreFocus) focusAfterMove.current = game.id;
    patchGame(game.id, status === "wishlist" ? { status, owned: false, installed: false } : { status, owned: true });
    setAnnouncement(`${game.title} movido para ${STATUS_LABEL[status]}.`);
  };

  const totalMatches = Object.values(grouped).reduce((sum, items) => sum + items.length, 0);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Quero jogar</h1>
          <p className="muted">Arraste os cards ou escolha um status para mover um jogo.</p>
        </div>
        <label className="board-search-label">
          <span>Filtrar cards</span>
          <input className="search-lite" type="search" placeholder="Nome ou gênero…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </header>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
      {query.trim() && totalMatches === 0 && (
        <p className="empty board-no-results" role="status">
          Nenhum jogo encontrado para “{query.trim()}”. <button className="link" onClick={() => setQuery("")}>Limpar busca</button>
        </p>
      )}
      <div className="board">
        {STATUS_ORDER.map((status) => {
          const col = grouped[status];
          return (
            <section
              key={status}
              className={`col ${over === status ? "over" : ""}`}
              style={{ "--c": STATUS_COLOR[status] } as React.CSSProperties}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(status); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null); }}
              onDrop={(e) => {
                e.preventDefault(); setOver(null);
                const game = games.find((item) => item.id === e.dataTransfer.getData("text/plain"));
                if (game) move(game, status);
              }}
              aria-label={`${STATUS_LABEL[status]}: ${col.length} jogos`}
            >
              <h2>{STATUS_LABEL[status]} <small>{col.length}</small></h2>
              <div className="col-body">
                {col.length === 0 ? (
                  <p className="board-column-empty">{query.trim() ? "Nenhum resultado nesta coluna." : "Nenhum jogo nesta coluna."}</p>
                ) : col.map((game) => (
                  <BoardCard key={game.id} game={game} onMove={(item, next) => move(item, next, true)} registerStatusSelect={(id, node) => {
                    if (node) statusSelects.current.set(id, node);
                    else if (statusSelects.current.get(id)?.isConnected === false) statusSelects.current.delete(id);
                  }} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
