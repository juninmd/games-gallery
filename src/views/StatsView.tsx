import { useMemo } from "react";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { PROVIDER_BY_ID } from "../domain/providers";
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "../domain/status";
import { type Bucket, computeStats } from "../domain/stats";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

function Bars({ title, rows }: { title: string; rows: { key: string; label: string; value: number; color?: string; note?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="panel">
      <h3>{title}</h3>
      {!rows.length && <p className="muted small">Sem dados.</p>}
      <ul className="bars">
        {rows.map((r) => (
          <li key={r.key}>
            <span className="bar-label" title={r.label}>{r.label}</span>
            <span className="bar-track"><i style={{ width: `${(r.value / max) * 100}%`, background: r.color }} /></span>
            <span className="bar-value">{r.value}{r.note ? <small> {r.note}</small> : null}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const bucketRows = (b: Bucket[], name: (id: string) => string | undefined) =>
  b.slice(0, 8).map((x) => ({ key: x.id, label: name(x.id) ?? x.id, value: x.games, note: x.hours ? `· ${Math.round(x.hours)} h` : undefined }));

export function StatsView() {
  const games = useLibrary((s) => s.games);
  const select = useUi((s) => s.select);
  const s = useMemo(() => computeStats(games), [games]);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Estatísticas</h1>
          <p className="muted">Calculadas só a partir da sua biblioteca; wishlist não entra nos totais.</p>
        </div>
        <dl className="stats">
          <div><dt>Comprados</dt><dd>{s.owned}</dd></div>
          <div><dt>Horas</dt><dd>{s.hours}</dd></div>
          <div><dt>Zerados</dt><dd>{Math.round(s.completionRate * 100)}%</dd></div>
          <div><dt>Nota média</dt><dd>{s.avgRating ?? "–"}</dd></div>
        </dl>
      </header>
      <div className="cards wide">
        <Bars title="Por status" rows={STATUS_ORDER.map((st) => ({ key: st, label: STATUS_LABEL[st], value: s.byStatus[st], color: STATUS_COLOR[st] }))} />
        <Bars title="Suas notas" rows={s.ratings.map((n, i) => ({ key: String(i), label: `${i + 1} ★`, value: n }))} />
        <Bars title="Plataformas" rows={bucketRows(s.byPlatform, (id) => PLATFORM_BY_ID[id]?.name)} />
        <Bars title="Provedores" rows={bucketRows(s.byProvider, (id) => PROVIDER_BY_ID[id]?.name)} />
        <section className="panel">
          <h3>Mais jogados</h3>
          {!s.mostPlayed.length && <p className="muted small">Nenhum jogo com horas registradas.</p>}
          <ol className="plain ranked">
            {s.mostPlayed.map((g) => (
              <li key={g.id}><button className="linkish" onClick={() => select(g.id)}>{g.title}</button> <span className="muted small">{g.playtimeH} h</span></li>
            ))}
          </ol>
        </section>
        <section className="panel">
          <h3>Backlog e disco</h3>
          <p><strong>{s.untouched}</strong> jogos comprados nunca foram jogados.</p>
          <p><strong>{s.installedGb} GB</strong> ocupados por jogos instalados com tamanho conhecido.</p>
        </section>
      </div>
    </>
  );
}
