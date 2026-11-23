import { m } from "motion/react";
import { Box, LayoutGrid, List, Rows3, SlidersHorizontal, StretchHorizontal, X } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import { facetsBy } from "../domain/facets";
import { CLEARED_FILTER, hasActiveFilter, type SortKey } from "../domain/filter";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { PROVIDER_BY_ID } from "../domain/providers";
import { STATUS_COLOR, STATUS_LABEL } from "../domain/status";
import type { PlayStatus } from "../domain/types";
import { useLibrary } from "../state/library";
import { FacetList } from "./FacetList";
import { DENSITIES, useUi, type Density } from "../state/ui";

const SORTS: [SortKey, string][] = [
  ["title", "Título"],
  ["year", "Mais recentes"],
  ["playtime", "Mais jogados"],
  ["rating", "Melhor avaliados"],
];

const MODES: [Density, string, string, ReactNode][] = [
  ["rails", "Trilhos", "Faixas por contexto: jogando, backlog, mais jogados…", <StretchHorizontal size={14} aria-hidden />],
  ["comfortable", "Grade", "Capas grandes", <LayoutGrid size={14} aria-hidden />],
  ["compact", "Compacta", "Mais jogos por tela", <Rows3 size={14} aria-hidden />],
  ["list", "Lista", "Linhas com status, nota e horas", <List size={14} aria-hidden />],
  ["boxes", "Caixas", "Caixas de jogo em estante 3D", <Box size={14} aria-hidden />],
];

/** Sticky bar under the hero: how to show the library, which stores, how to sort, and the rest of the filters. */
export function FilterBar({ lockInstalled = false }: { lockInstalled?: boolean }) {
  const filter = useUi((s) => s.filter);
  const setFilter = useUi((s) => s.setFilter);
  const density = useUi((s) => s.density);
  const setDensity = useUi((s) => s.setDensity);
  const games = useLibrary((s) => s.games);

  // "G" cycles the display modes, like a gallery remote.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key.toLowerCase() !== "g" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) || document.querySelector("dialog[open]")) return;
      const current = useUi.getState().density;
      setDensity(DENSITIES[(DENSITIES.indexOf(current) + 1) % DENSITIES.length]!);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setDensity]);

  const providerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of games) counts.set(g.providerId, (counts.get(g.providerId) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [games]);

  const toggleProvider = (id: string) =>
    setFilter({ providerIds: filter.providerIds.includes(id) ? filter.providerIds.filter((x) => x !== id) : [...filter.providerIds, id] });

  const platformFacets = useMemo(() => facetsBy(games, (g) => [g.platformId], (id) => PLATFORM_BY_ID[id]?.name ?? id), [games]);
  const statusFacets = useMemo(() => facetsBy(games, (g) => [g.status], (id) => STATUS_LABEL[id as PlayStatus] ?? id), [games]);
  const tagFacets = useMemo(() => facetsBy(games, (g) => g.tags ?? [], (t) => t), [games]);
  const loaned = useMemo(() => games.some((g) => g.loan), [games]);
  const extra = [filter.platformId, filter.status, filter.tag, filter.ownedOnly, filter.multiStoreOnly, filter.loanedOnly, !lockInstalled && filter.installedOnly].filter(Boolean).length;

  return (
    <div className="library-bar" role="toolbar" aria-label="Exibição e filtros da biblioteca">
      <div className="mode-seg" role="group" aria-label="Modo de exibição">
        {MODES.map(([key, label, title, icon]) => {
          const on = density === key;
          return (
            <button key={key} type="button" aria-pressed={on} title={title} onClick={() => setDensity(key)}>
              {on && <m.span layoutId="mode-thumb" className="mode-thumb" transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
              <span className="mode-label">{icon}<span>{label}</span></span>
            </button>
          );
        })}
      </div>

      <div className="store-chips" role="group" aria-label="Lojas">
        {providerCounts.map(([id, n]) => {
          const p = PROVIDER_BY_ID[id];
          const on = filter.providerIds.includes(id);
          return (
            <button key={id} type="button" aria-pressed={on} onClick={() => toggleProvider(id)} className="store-chip" style={{ "--c": p?.color ?? "#888" } as React.CSSProperties}>
              <i aria-hidden />{p?.name ?? id}<small>{n}</small>
            </button>
          );
        })}
      </div>

      <div className="library-bar-end">
        <button type="button" className="bar-btn" popoverTarget="library-filters" aria-label={`Mais filtros${extra ? `, ${extra} ativos` : ""}`}>
          <SlidersHorizontal size={14} aria-hidden /> Filtros{extra > 0 && <span className="bar-count">{extra}</span>}
        </button>
        <select className="bar-select" aria-label="Ordenar" value={filter.sort} onChange={(e) => setFilter({ sort: e.target.value as SortKey })}>
          {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      <div id="library-filters" popover="auto" className="filters-panel" aria-label="Mais filtros">
        <div className="filters-grid">
          <FacetList title="Plataforma" facets={platformFacets} selected={filter.platformId} onSelect={(platformId) => setFilter({ platformId })} colorOf={(id) => PLATFORM_BY_ID[id]?.color} />
          <FacetList title="Status" facets={statusFacets} selected={filter.status} onSelect={(status) => setFilter({ status: status as PlayStatus | null })} colorOf={(id) => STATUS_COLOR[id as PlayStatus]} />
          <FacetList title="Tag" facets={tagFacets} selected={filter.tag} onSelect={(tag) => setFilter({ tag })} />
        </div>
        <div className="filters-toggles">
          {!lockInstalled && (
            <label className="check"><input type="checkbox" checked={filter.installedOnly} onChange={(e) => setFilter({ installedOnly: e.target.checked })} /> Só instalados</label>
          )}
          <label className="check"><input type="checkbox" checked={filter.ownedOnly} onChange={(e) => setFilter({ ownedOnly: e.target.checked })} /> Só comprados</label>
          <label className="check"><input type="checkbox" checked={filter.multiStoreOnly} onChange={(e) => setFilter({ multiStoreOnly: e.target.checked })} /> Em mais de uma loja</label>
          {(loaned || filter.loanedOnly) && (
            <label className="check"><input type="checkbox" checked={filter.loanedOnly} onChange={(e) => setFilter({ loanedOnly: e.target.checked })} /> Emprestados</label>
          )}
        </div>
        <button type="button" className="btn ghost" onClick={() => setFilter(CLEARED_FILTER)} disabled={!hasActiveFilter(filter)}>
          <X size={13} aria-hidden /> Limpar filtros
        </button>
      </div>
    </div>
  );
}
