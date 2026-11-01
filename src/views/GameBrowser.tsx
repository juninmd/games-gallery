import { BadgeCheck, Hourglass, LayoutGrid, Library, Rows3, Timer } from "lucide-react";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { CountUp } from "../components/CountUp";
import { FeaturedHero } from "../components/FeaturedHero";
import { FilterBar } from "../components/FilterBar";
import { GameCard } from "../components/GameCard";
import { featuredGroup, filterGameGroups, groupGames, groupStats } from "../domain/duplicates";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

const PAGE_SIZE = 60;

function StatTile({ icon, label, value, accent }: { icon: ReactNode; label: string; value: number; accent: string }) {
  return (
    <div className="glass group relative min-w-[118px] overflow-hidden rounded-2xl px-4 py-3 transition-all duration-300 ease-expo hover:-translate-y-1 hover:border-white/20">
      <span aria-hidden className={`absolute -right-5 -top-5 size-16 rounded-full opacity-30 blur-2xl transition-opacity duration-300 group-hover:opacity-60 ${accent}`} />
      <dt className="relative flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fog">{icon}{label}</dt>
      <dd className="relative m-0 mt-1 font-display text-[28px] font-bold leading-none tracking-tight text-mist tabular-nums"><CountUp value={value} /></dd>
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
  const setDensity = useUi((s) => s.setDensity);
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
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const requestedPage = criteriaChanged ? 1 : pageState.page;
  const page = Math.min(requestedPage, pageCount);
  if (page !== requestedPage) setPageState((s) => ({ ...s, page }));
  const pageGames = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = shown.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(page * PAGE_SIZE, shown.length);

  const filtering = Boolean(
    filter.query.trim() || filter.providerIds.length || filter.platformId || filter.status || filter.installedOnly || filter.ownedOnly || filter.multiStoreOnly,
  );
  const featured = useMemo(() => (scope === "all" ? featuredGroup(allGroups) : undefined), [scope, allGroups]);
  const showHero = scope === "all" && !filtering && page === 1;

  const clearFilters = () => setFilter({
    query: "",
    providerIds: [],
    platformId: null,
    status: null,
    installedOnly: false,
    ownedOnly: false,
    multiStoreOnly: false,
  });

  return (
    <>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-6">
        <div className="grid gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-fog">Sua coleção</span>
          <h1 className="text-gradient w-fit pb-1">{scope === "installed" ? "Instalados" : platform ? platform.name : "Biblioteca"}</h1>
          <p className="text-sm text-fog" aria-live="polite">
            {shown.length} de {scopedCount} jogos
            {stats.duplicates > 0 && <span> · {stats.duplicates} em mais de uma loja</span>}
            {isUpdating && <span className="updating text-aurora"> · Atualizando resultados…</span>}
          </p>
        </div>
        <dl className="m-0 flex flex-wrap gap-3">
          <StatTile icon={<Library size={12} aria-hidden />} label="Comprados" value={stats.owned} accent="bg-rose" />
          <StatTile icon={<BadgeCheck size={12} aria-hidden />} label="Instalados" value={stats.installed} accent="bg-aurora" />
          <StatTile icon={<Hourglass size={12} aria-hidden />} label="Backlog" value={stats.backlog} accent="bg-ember" />
          <StatTile icon={<Timer size={12} aria-hidden />} label="Horas" value={stats.hours} accent="bg-orchid" />
        </dl>
      </header>
      {showHero && featured && <FeaturedHero group={featured} />}
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
          <div className="result-toolbar" aria-busy={isUpdating}>
            <p className="muted" aria-live="polite">
              Exibindo {rangeStart}–{rangeEnd} de {shown.length} jogos
              {isUpdating && <span className="updating"> · Atualizando…</span>}
            </p>
            <div className="flex items-center gap-1" role="group" aria-label="Densidade da grade">
              <button type="button" className="btn ghost" aria-pressed={density === "comfortable"} title="Capas grandes" onClick={() => setDensity("comfortable")}><LayoutGrid size={14} aria-hidden /> Confortável</button>
              <button type="button" className="btn ghost" aria-pressed={density === "compact"} title="Mais jogos por tela" onClick={() => setDensity("compact")}><Rows3 size={14} aria-hidden /> Compacta</button>
            </div>
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
          <div className="game-grid" data-density={density} aria-busy={isUpdating}>
            {pageGames.map((x, i) => <GameCard key={x.primary.id} game={x.primary} members={x.members} index={i} />)}
          </div>
        </>
      )}
    </>
  );
}
