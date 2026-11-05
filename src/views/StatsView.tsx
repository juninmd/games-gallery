import { useMemo } from "react";
import { StoreChips } from "../components/StoreChips";
import { WrappedPanel } from "../components/WrappedPanel";
import { groupGames, groupStats } from "../domain/duplicates";
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
      <h3 aria-level={2}>{title}</h3>
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
  const groups = useMemo(() => groupGames(games), [games]);
  const dup = useMemo(() => groupStats(groups), [groups]);
  const shared = useMemo(() => groups.filter((x) => x.members.length > 1).sort((a, b) => b.members.length - a.members.length || a.primary.title.localeCompare(b.primary.title)).slice(0, 8), [groups]);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Estatísticas</h1>
          <p className="muted">Calculadas só a partir da sua biblioteca; wishlist não entra nos totais. Um jogo em várias lojas conta uma vez em Comprados; os gráficos por loja contam cada cópia.</p>
        </div>
        <dl className="stats">
          <div><dt>Comprados</dt><dd>{dup.owned}</dd></div>
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
          <h3 aria-level={2}>Mais jogados</h3>
          {!s.mostPlayed.length && <p className="muted small">Nenhum jogo com horas registradas.</p>}
          <ol className="plain ranked">
            {s.mostPlayed.map((g) => (
              <li key={g.id}><button className="linkish" onClick={() => select(g.id)}>{g.title}</button> <span className="muted small">{g.playtimeH} h</span></li>
            ))}
          </ol>
        </section>
        <section className="panel">
          <h3 aria-level={2}>Repetidos entre lojas</h3>
          {!dup.duplicates ? (
            <p className="muted small">Nenhum jogo aparece em mais de uma loja.</p>
          ) : (
            <>
              <p><strong>{dup.duplicates}</strong> jogos estão em mais de uma loja; {dup.foldedCopies} cópias foram unificadas na biblioteca ({dup.total} jogos únicos).</p>
              <ul className="plain ranked">
                {shared.map((x) => (
                  <li key={x.primary.id} className="grid gap-0.5">
                    <button className="linkish text-left" onClick={() => select(x.primary.id)}>{x.primary.title}</button>
                    <StoreChips members={x.members} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <WrappedPanel />
        <section className="panel">
          <h3 aria-level={2}>Backlog e disco</h3>
          <p><strong>{s.untouched}</strong> jogos comprados nunca foram jogados.</p>
          <p><strong>{s.installedGb} GB</strong> ocupados por jogos instalados com tamanho conhecido.</p>
        </section>
      </div>
    </>
  );
}
