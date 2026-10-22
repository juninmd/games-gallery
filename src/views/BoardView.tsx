import { useState } from "react";
import { Cover } from "../components/Cover";
import { PlatformTag } from "../components/Badges";
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "../domain/status";
import type { Game, PlayStatus } from "../domain/types";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

function BoardCard({ game }: { game: Game }) {
  const select = useUi((s) => s.select);
  return (
    <button
      className="bcard"
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", game.id)}
      onClick={() => select(game.id)}
    >
      <div className="bcover"><Cover game={game} /></div>
      <div>
        <strong>{game.title}</strong>
        <div className="tags"><PlatformTag id={game.platformId} />{game.installed && <span className="tag ok">instalado</span>}</div>
      </div>
    </button>
  );
}

export function BoardView() {
  const games = useLibrary((s) => s.games);
  const patchGame = useLibrary((s) => s.patchGame);
  const [over, setOver] = useState<PlayStatus | null>(null);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const move = (id: string, status: PlayStatus) =>
    patchGame(id, status === "wishlist" ? { status, owned: false, installed: false } : { status, owned: true });

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Quero jogar</h1>
          <p className="muted">Arraste os cards entre as colunas para mudar o status.</p>
        </div>
        <input className="search-lite" type="search" placeholder="Filtrar cards…" aria-label="Filtrar cards" value={query} onChange={(e) => setQuery(e.target.value)} />
      </header>
      <div className="board">
        {STATUS_ORDER.map((status) => {
          const col = games.filter((g) => g.status === status && (!q || g.title.toLowerCase().includes(q)));
          return (
            <section
              key={status}
              className={`col ${over === status ? "over" : ""}`}
              style={{ "--c": STATUS_COLOR[status] } as React.CSSProperties}
              onDragOver={(e) => { e.preventDefault(); setOver(status); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) move(id, status); }}
              aria-label={STATUS_LABEL[status]}
            >
              <h2>{STATUS_LABEL[status]} <small>{col.length}</small></h2>
              <div className="col-body">
                {col.map((g) => <BoardCard key={g.id} game={g} />)}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
