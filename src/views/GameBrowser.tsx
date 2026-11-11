import { useDeferredValue, useMemo, useState } from "react";
import { BoxShelf } from "../components/box/BoxShelf";
import { CountUp } from "../components/CountUp";
import { FilterBar } from "../components/FilterBar";
import { GameCard } from "../components/GameCard";
import { GameList } from "../components/GameList";
import { GameRails } from "../components/GameRails";
import { HeroCarousel } from "../components/HeroCarousel";
import { featuredGroup, filterGameGroups, groupGames, groupStats, nowPlayingGroups } from "../domain/duplicates";
import { CLEARED_FILTER, hasActiveFilter } from "../domain/filter";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

const PAGE_SIZE = 60;
/** Every box is a small 3D scene, so a shelf page holds fewer of them. */
const BOX_PAGE_SIZE = 30;

function Num({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="lib-num">
      <i aria-hidden style={{ background: color }} />
      <dd><CountUp value={value} /></dd>
      <dt>{label}</dt>
    </div>
  );
}

interface PageState {
  scope: "all" | "installed";
  filter: ReturnType<typeof useUi.getState>["filter"];
  page: number;
}

export function GameBrowser({ scope }: { scope: "all" | "installed" }) {
  const games = useLibrary((s) => s.games);
  const detect = useLibrary((s) => s.detect);
  const filter = useUi((s) => s.filter);
  const setFilter = useUi((s) => s.setFilter);
  const setAddOpen = useUi((s) => s.setAddOpen);
  const go = useUi((s) => s.go);
  const density = useUi((s) => s.density);
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
  const shown = useMemo(() => filterGameGroups(games, effective), [games, effective]);
  const allGroups = useMemo(() => groupGames(games), [games]);
  const stats = useMemo(() => groupStats(allGroups), [allGroups]);
  const scopedCount = scope === "installed" ? stats.installed : stats.total;
  const platform = filter.platformId ? PLATFORM_BY_ID[filter.platformId] : null;
  const filtering = hasActiveFilter(filter);
  // Rails summarize the whole collection; a filter or search switches them to the grid of results.
  const mode = density === "rails" && filtering ? "comfortable" : density;
  const pageSize = mode === "boxes" ? BOX_PAGE_SIZE : PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
  const requestedPage = criteriaChanged ? 1 : pageState.page;
  const page = Math.min(requestedPage, pageCount);
  if (page !== requestedPage) setPageState((s) => ({ ...s, page }));
  const pageGames = shown.slice((page - 1) * pageSize, page * pageSize);
  const rangeStart = shown.length ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, shown.length);

  const slides = useMemo(() => {
    if (scope !== "all") return [];
    const playing = nowPlayingGroups(allGroups).slice(0, 5);
    if (playing.length) return playing;
    const featured = featuredGroup(allGroups);
    return featured ? [featured] : [];
  }, [scope, allGroups]);
  const showHero = scope === "all" && !filtering && page === 1 && slides.length > 0;

  const clearFilters = () => setFilter(CLEARED_FILTER);

  return (
    <>
      {showHero ? <HeroCarousel slides={slides} groups={allGroups} /> : (
        <header className="lib-head">
          <span className="eyebrow">Sua coleção</span>
          <h1 className="lib-title text-gradient">{scope === "installed" ? "Instalados" : platform ? platform.name : filtering ? "Resultados" : "Biblioteca"}</h1>
        </header>
      )}
      <div className="lib-nums">
        <dl>
          <Num label="Comprados" value={stats.owned} color="var(--color-rose)" />
          <Num label="Instalados" value={stats.installed} color="var(--color-aurora)" />
          <Num label="Backlog" value={stats.backlog} color="var(--color-orchid)" />
          <Num label="Horas" value={stats.hours} color="var(--color-ember)" />
        </dl>
        <p aria-live="polite">
          {shown.length} de {scopedCount} jogos
          {stats.duplicates > 0 && <span> · {stats.duplicates} em mais de uma loja</span>}
          {isUpdating && <span className="updating text-aurora"> · Atualizando resultados…</span>}
        </p>
      </div>
      <FilterBar lockInstalled={scope === "installed"} />

      {games.length === 0 ? (
        <section className="discovery-empty" aria-labelledby="empty-library-title">
          <h2 id="empty-library-title">Sua biblioteca ainda está vazia</h2>
          <p>O app lê as bibliotecas dos launchers instalados no seu PC (Steam, Epic, GOG, itch.io…) e as pastas de ROMs que você escolher. Para listar também o que você comprou e não instalou, entre nas suas contas em Conexões.</p>
          <div className="discovery-actions">
            <button className="btn primary" type="button" onClick={() => void detect()}>Detectar bibliotecas</button>
            <button className="btn" type="button" onClick={() => go("connections")}>Conectar contas</button>
            <button className="btn" type="button" onClick={() => setAddOpen(true)}>Adicionar jogo</button>
          </div>
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
          {mode !== "rails" && (
            <div className="result-toolbar" aria-busy={isUpdating}>
              <p className="muted" aria-live="polite">
                Exibindo {rangeStart}–{rangeEnd} de {shown.length} jogos
                {isUpdating && <span className="updating"> · Atualizando…</span>}
              </p>
              {pageCount > 1 && (
                <nav className="pagination" aria-label="Paginação da biblioteca">
                  <button className="btn" type="button" onClick={() => setPageState((s) => ({ ...s, page: Math.max(1, s.page - 1) }))} disabled={page <= 1}>
                    Anterior
                  </button>
                  <span aria-current="page">Página {page} de {pageCount}</span>
                  <button className="btn" type="button" onClick={() => setPageState((s) => ({ ...s, page: Math.min(pageCount, s.page + 1) }))} disabled={page >= pageCount}>
                    Próxima
                  </button>
                </nav>
              )}
            </div>
          )}
          {mode === "rails" ? (
            <GameRails groups={shown} />
          ) : mode === "boxes" ? (
            <BoxShelf groups={pageGames} busy={isUpdating} />
          ) : mode === "list" ? (
            <GameList groups={pageGames} busy={isUpdating} />
          ) : (
            <div className="game-grid" data-density={mode} aria-busy={isUpdating}>
              {pageGames.map((x, i) => <GameCard key={x.primary.id} game={x.primary} members={x.members} index={i} />)}
            </div>
          )}
        </>
      )}
    </>
  );
}
