import { useDeferredValue, useMemo, useState } from "react";
import { FilterBar } from "../components/FilterBar";
import { GameCard } from "../components/GameCard";
import { filterGames, libraryStats } from "../domain/filter";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

const PAGE_SIZE = 60;

interface PageState {
  scope: "all" | "installed";
  filter: ReturnType<typeof useUi.getState>["filter"];
  page: number;
}

export function GameBrowser({ scope }: { scope: "all" | "installed" }) {
  const games = useLibrary((s) => s.games);
  const filter = useUi((s) => s.filter);
  const setFilter = useUi((s) => s.setFilter);
  const setAddOpen = useUi((s) => s.setAddOpen);
  const go = useUi((s) => s.go);
  const deferredFilter = useDeferredValue(filter);
  const isUpdating = deferredFilter !== filter;
  const [pageState, setPageState] = useState<PageState>(() => ({ scope, filter, page: 1 }));

  // Reset during render so a filter or scope change never commits a stale page first.
  const criteriaChanged = pageState.scope !== scope || pageState.filter !== filter;
  if (criteriaChanged) {
    setPageState({ scope, filter, page: 1 });
  }

  const effective = useMemo(
    () => scope === "installed" ? { ...deferredFilter, installedOnly: true } : deferredFilter,
    [scope, deferredFilter],
  );
  const shown = useMemo(() => filterGames(games, effective), [games, effective]);
  const stats = useMemo(() => libraryStats(games), [games]);
  const scopedCount = scope === "installed" ? stats.installed : games.length;
  const platform = filter.platformId ? PLATFORM_BY_ID[filter.platformId] : null;
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const requestedPage = criteriaChanged ? 1 : pageState.page;
  const page = Math.min(requestedPage, pageCount);
  if (page !== requestedPage) setPageState((s) => ({ ...s, page }));
  const pageGames = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = shown.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(page * PAGE_SIZE, shown.length);

  const clearFilters = () => setFilter({
    query: "",
    providerIds: [],
    platformId: null,
    status: null,
    installedOnly: false,
    ownedOnly: false,
  });

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{scope === "installed" ? "Instalados" : platform ? platform.name : "Biblioteca"}</h1>
          <p className="muted" aria-live="polite">
            {shown.length} de {scopedCount} jogos
            {isUpdating && <span className="updating"> · Atualizando resultados…</span>}
          </p>
        </div>
        <dl className="stats">
          <div><dt>Comprados</dt><dd>{stats.owned}</dd></div>
          <div><dt>Instalados</dt><dd>{stats.installed}</dd></div>
          <div><dt>Backlog</dt><dd>{stats.backlog}</dd></div>
          <div><dt>Horas</dt><dd>{stats.hours}</dd></div>
        </dl>
      </header>
      <FilterBar lockInstalled={scope === "installed"} />

      {games.length === 0 ? (
        <section className="discovery-empty" aria-labelledby="empty-library-title">
          <h2 id="empty-library-title">Sua biblioteca ainda está vazia</h2>
          <p>Adicione um jogo para começar a organizar sua coleção.</p>
          <button className="btn primary" type="button" onClick={() => setAddOpen(true)}>Adicionar jogo</button>
        </section>
      ) : scope === "installed" && stats.installed === 0 ? (
        <section className="discovery-empty" aria-labelledby="empty-installed-title">
          <h2 id="empty-installed-title">Nenhum jogo instalado ainda</h2>
          <p>Os jogos da sua biblioteca aparecerão aqui quando forem instalados.</p>
          <div className="discovery-actions">
            <button className="btn" type="button" onClick={() => go("library")}>Ver biblioteca</button>
            <button className="btn primary" type="button" onClick={() => setAddOpen(true)}>Adicionar jogo</button>
          </div>
        </section>
      ) : shown.length === 0 ? (
        <section className="discovery-empty" aria-labelledby="empty-results-title">
          <h2 id="empty-results-title">Nenhum jogo corresponde a esta busca</h2>
          <p>Tente outro termo ou limpe os filtros para voltar a ver a biblioteca.</p>
          <button className="btn" type="button" onClick={clearFilters}>Limpar filtros</button>
        </section>
      ) : (
        <>
          <div className="result-toolbar" aria-busy={isUpdating}>
            <p className="muted" aria-live="polite">
              Exibindo {rangeStart}–{rangeEnd} de {shown.length} jogos
              {isUpdating && <span className="updating"> · Atualizando…</span>}
            </p>
            <nav className="pagination" aria-label="Paginação da biblioteca">
              <button className="btn" type="button" onClick={() => setPageState((s) => ({ ...s, page: Math.max(1, s.page - 1) }))} disabled={page <= 1}>
                Anterior
              </button>
              <span aria-current="page">Página {page} de {pageCount}</span>
              <button className="btn" type="button" onClick={() => setPageState((s) => ({ ...s, page: Math.min(pageCount, s.page + 1) }))} disabled={page >= pageCount}>
                Próxima
              </button>
            </nav>
          </div>
          <div className="grid" aria-busy={isUpdating}>
            {pageGames.map((g, i) => <GameCard key={g.id} game={g} index={i} />)}
          </div>
        </>
      )}
    </>
  );
}
