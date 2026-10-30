import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FreebieCard } from "../components/FreebieCard";
import { PS_PLUS_PLATFORMS, monthPt, psPlusFreebies, settle } from "../domain/freebies";
import { PS_CRAWL_DELAY_MS, PS_MAX_PAGES } from "../platform/freebiesApi";
import { useFreebies } from "../state/freebies";

const stamp = (t?: number) => (t ? new Date(t).toLocaleString("pt-BR") : "nunca");

function EpicSection() {
  const { epic, loading, errors, refreshEpic } = useFreebies();
  useEffect(() => void refreshEpic(), [refreshEpic]);
  const live = useMemo(() => settle(epic?.items ?? []), [epic]);
  const now = live.filter((f) => f.status === "now");
  const upcoming = live.filter((f) => f.status === "upcoming");

  return (
    <section className="section-group">
      <div className="section-head">
        <h2>Epic Games Store</h2>
        <button className="btn ghost" disabled={loading.epic} onClick={() => refreshEpic(true)}>
          <RefreshCw size={13} aria-hidden /> {loading.epic ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
      <p className="muted small">Atualizado em {stamp(epic?.fetchedAt)}. Fonte: endpoint público que a própria loja usa (não oficial; pode mudar).</p>
      {errors.epic && <p className="note warn" role="alert">Não foi possível ler a Epic: {errors.epic}</p>}
      {!epic && !loading.epic && !errors.epic && <p className="empty">Nada carregado ainda.</p>}
      {epic && !now.length && <p className="empty">Nenhum jogo gratuito agora.</p>}
      <div className="freebie-grid">{now.map((f) => <FreebieCard key={f.id} freebie={f} />)}</div>
      {!!upcoming.length && (
        <>
          <h3 className="sub">Em breve</h3>
          <div className="freebie-grid">{upcoming.map((f) => <FreebieCard key={f.id} freebie={f} />)}</div>
        </>
      )}
    </section>
  );
}

function PsPlusSection() {
  const { ps, loading, psPage, errors, refreshPs } = useFreebies();
  const [platformId, setPlatformId] = useState<string>(PS_PLUS_PLATFORMS[0]);
  const items = ps?.month ? psPlusFreebies(ps.month) : [];

  return (
    <section className="section-group">
      <div className="section-head">
        <h2>PlayStation Plus: jogos do mês</h2>
        <div className="inline">
          <select aria-label="Plataforma dos jogos do mês" value={platformId} onChange={(e) => setPlatformId(e.target.value)}>
            {PS_PLUS_PLATFORMS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
          <button className="btn ghost" disabled={loading.ps} onClick={() => refreshPs(true)}>
            <RefreshCw size={13} aria-hidden /> {loading.ps ? `Buscando… página ${psPage}/${PS_MAX_PAGES}` : "Buscar jogos do mês"}
          </button>
        </div>
      </div>
      <p className="muted small">
        Atualizado em {stamp(ps?.fetchedAt)}. Não há API aberta: o app lê o feed do PlayStation Blog, uma página por vez, esperando {PS_CRAWL_DELAY_MS / 1000} s entre elas (pode levar cerca de {(PS_MAX_PAGES - 1) * (PS_CRAWL_DELAY_MS / 1000)} s). Os nomes vêm do título do post: confira no anúncio.
      </p>
      <span className="sr-only" role="status">{loading.ps ? `Buscando jogos do mês, página ${psPage} de ${PS_MAX_PAGES}` : ""}</span>
      {errors.ps && <p className="note warn" role="alert">{errors.ps}</p>}
      {ps?.month && <p className="muted small">Jogos de {monthPt(ps.month.month)} (post de {new Date(ps.month.publishedAt || Date.now()).toLocaleDateString("pt-BR")})</p>}
      {!ps && !loading.ps && !errors.ps && <p className="empty">Clique em “Buscar jogos do mês”.</p>}
      <div className="freebie-grid">{items.map((f) => <FreebieCard key={f.id} freebie={f} platformId={platformId} />)}</div>
    </section>
  );
}

export function FreebiesView() {
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Jogos grátis</h1>
          <p className="muted">Epic Games Store e PlayStation Plus. O app não resgata por você: o resgate exige o seu login na loja ou no console.</p>
        </div>
      </header>
      <EpicSection />
      <PsPlusSection />
    </>
  );
}
