import { Star } from "lucide-react";
import type { CSSProperties } from "react";
import { totalHours, type GameGroup } from "../domain/duplicates";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { STATUS_COLOR, STATUS_LABEL } from "../domain/status";
import { useUi } from "../state/ui";
import { Cover } from "./Cover";
import { ambientFor, openGame } from "./shell/ambient";
import { storeSummary } from "./StoreChips";

/** Dense, scannable rows: everything at a glance, sorted by the bar above. */
export function GameList({ groups, busy }: { groups: GameGroup[]; busy: boolean }) {
  const setAmbient = useUi((s) => s.setAmbient);

  return (
    <div className="game-list" role="list" aria-busy={busy}>
      <div className="game-row game-row-head" aria-hidden>
        <span />
        <span>Jogo</span>
        <span>Plataforma · lojas</span>
        <span>Status</span>
        <span className="num">Nota</span>
        <span className="num">Horas</span>
      </div>
      {groups.map(({ primary: g, members }, i) => (
        <button
          key={g.id}
          type="button"
          role="listitem"
          className="game-row"
          style={{ animationDelay: `${Math.min(i, 24) * 18}ms` } as CSSProperties}
          onPointerEnter={() => setAmbient(ambientFor(g))}
          onClick={(e) => openGame(g.id, e.currentTarget.querySelector<HTMLElement>(".cover"))}
          aria-label={`Abrir ${g.title}`}
        >
          <span className="game-row-cover"><Cover game={g.coverUrl ? g : { ...g, coverUrl: members.find((x) => x.coverUrl)?.coverUrl }} /></span>
          <span className="game-row-title">
            <b>{g.title}</b>
            {members.some((x) => x.installed) && <small className="game-row-ok">instalado</small>}
            {g.loan && <small className="game-row-loan">emprestado</small>}
          </span>
          <span className="game-row-sub">{PLATFORM_BY_ID[g.platformId]?.short ?? g.platformId} · {storeSummary(members, 2).names.join(", ")}</span>
          <span className="game-row-status" style={{ "--c": STATUS_COLOR[g.status] } as CSSProperties}><i />{STATUS_LABEL[g.status]}</span>
          <span className="num game-row-rating">{g.rating ? <><Star size={12} className="fill-current" aria-hidden />{g.rating}</> : "—"}</span>
          <span className="num tabular-nums">{totalHours(members).toLocaleString("pt-BR")} h</span>
        </button>
      ))}
    </div>
  );
}
