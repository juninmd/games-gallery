import { m } from "motion/react";
import { Box, LayoutGrid, List, Rows3, SlidersHorizontal, StretchHorizontal, X } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import { tagCounts } from "../domain/collection";
import { CLEARED_FILTER, hasActiveFilter, type SortKey } from "../domain/filter";
import { FAMILY_LABEL, PLATFORMS } from "../domain/platforms";
import { PROVIDER_BY_ID } from "../domain/providers";
import { STATUS_LABEL, STATUS_ORDER } from "../domain/status";
import type { PlayStatus } from "../domain/types";
import { useLibrary } from "../state/library";
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

  const tags = useMemo(() => tagCounts(games), [games]);
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
          <label>Plataforma
            <select aria-label="Plataforma" value={filter.platformId ?? ""} onChange={(e) => setFilter({ platformId: e.target.value || null })}>
              <option value="">Todas as plataformas</option>
              {(Object.keys(FAMILY_LABEL) as (keyof typeof FAMILY_LABEL)[]).map((fam) => (
                <optgroup key={fam} label={FAMILY_LABEL[fam]}>
                  {PLATFORMS.filter((p) => p.family === fam).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label>Status
            <select aria-label="Status" value={filter.status ?? ""} onChange={(e) => setFilter({ status: (e.target.value || null) as PlayStatus | null })}>
              <option value="">Qualquer status</option>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          {(tags.length > 0 || filter.tag) && (
            <label>Tag
              <select aria-label="Tag" value={filter.tag ?? ""} onChange={(e) => setFilter({ tag: e.target.value || null })}>
                <option value="">Qualquer tag</option>
                {filter.tag && !tags.some(([t]) => t === filter.tag) && <option value={filter.tag}>{filter.tag}</option>}
                {tags.map(([t, n]) => <option key={t} value={t}>{t} ({n})</option>)}
              </select>
            </label>
          )}
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
