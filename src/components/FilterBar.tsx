import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type { SortKey } from "../domain/filter";
import { FAMILY_LABEL, PLATFORMS } from "../domain/platforms";
import { PROVIDER_BY_ID } from "../domain/providers";
import { STATUS_LABEL, STATUS_ORDER } from "../domain/status";
import type { PlayStatus } from "../domain/types";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

const SORTS: [SortKey, string][] = [
  ["title", "Título"],
  ["year", "Mais recentes"],
  ["playtime", "Mais jogados"],
  ["rating", "Melhor avaliados"],
];

const selectCls =
  "rounded-full border border-white/10 bg-white/[0.04] py-2 pl-4 pr-3 text-[13px] font-medium text-mist transition-colors hover:bg-white/[0.08] focus:border-rose focus:outline-none focus:ring-4 focus:ring-rose/15";
const toggleCls = "inline-flex cursor-pointer items-center gap-2 rounded-full px-2 py-1.5 text-[13px] text-fog transition-colors hover:text-mist";

export function FilterBar({ lockInstalled = false }: { lockInstalled?: boolean }) {
  const filter = useUi((s) => s.filter);
  const setFilter = useUi((s) => s.setFilter);
  const games = useLibrary((s) => s.games);
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" jumps to the search box, like most modern galleries and docs sites.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const providerCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of games) m.set(g.providerId, (m.get(g.providerId) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [games]);

  const toggleProvider = (id: string) =>
    setFilter({
      providerIds: filter.providerIds.includes(id)
        ? filter.providerIds.filter((x) => x !== id)
        : [...filter.providerIds, id],
    });

  const hasActiveFilters = Boolean(
    filter.query.trim() || filter.providerIds.length || filter.platformId || filter.status ||
    filter.installedOnly || filter.ownedOnly,
  );

  const clearFilters = () => setFilter({
    query: "",
    providerIds: [],
    platformId: null,
    status: null,
    installedOnly: false,
    ownedOnly: false,
  });

  return (
    <div className="glass mb-7 grid gap-4 rounded-3xl p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="group relative flex min-w-[260px] flex-[1_1_300px] items-center gap-2.5 rounded-full border border-white/10 bg-ink-950/40 px-4 text-fog transition-all focus-within:border-rose focus-within:text-mist focus-within:ring-4 focus-within:ring-rose/15">
          <Search size={16} aria-hidden />
          <input
            ref={searchRef}
            type="search"
            placeholder="Buscar por título ou gênero…"
            value={filter.query}
            onChange={(e) => setFilter({ query: e.target.value })}
            aria-label="Buscar jogos"
            className="!m-0 min-w-0 flex-1 !border-0 !bg-transparent !px-0 !py-2.5 text-sm text-mist !shadow-none placeholder:text-fog/70 focus:!ring-0"
          />
          <kbd aria-hidden className="rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px] text-fog group-focus-within:hidden">/</kbd>
        </label>
        <select className={selectCls} aria-label="Plataforma" value={filter.platformId ?? ""} onChange={(e) => setFilter({ platformId: e.target.value || null })}>
          <option value="">Todas as plataformas</option>
          {(Object.keys(FAMILY_LABEL) as (keyof typeof FAMILY_LABEL)[]).map((fam) => (
            <optgroup key={fam} label={FAMILY_LABEL[fam]}>
              {PLATFORMS.filter((p) => p.family === fam).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select className={selectCls} aria-label="Status" value={filter.status ?? ""} onChange={(e) => setFilter({ status: (e.target.value || null) as PlayStatus | null })}>
          <option value="">Qualquer status</option>
          {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className={selectCls} aria-label="Ordenar" value={filter.sort} onChange={(e) => setFilter({ sort: e.target.value as SortKey })}>
          {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {!lockInstalled && (
          <label className={toggleCls}>
            <input type="checkbox" checked={filter.installedOnly} onChange={(e) => setFilter({ installedOnly: e.target.checked })} />
            Só instalados
          </label>
        )}
        <label className={toggleCls}>
          <input type="checkbox" checked={filter.ownedOnly} onChange={(e) => setFilter({ ownedOnly: e.target.checked })} />
          Só comprados
        </label>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Provedores">
          {providerCounts.map(([id, n]) => {
            const p = PROVIDER_BY_ID[id];
            const on = filter.providerIds.includes(id);
            return (
              <button
                key={id}
                aria-pressed={on}
                onClick={() => toggleProvider(id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-expo hover:-translate-y-0.5 active:scale-95 ${on ? "border-transparent bg-signature text-white shadow-glow" : "border-white/10 bg-white/[0.04] text-mist hover:border-white/25 hover:bg-white/[0.08]"}`}
              >
                <i className="size-2 rounded-full ring-2 ring-white/10" style={{ background: p?.color }} />
                {p?.name ?? id}
                <small className={`tabular-nums ${on ? "text-white/80" : "text-fog"}`}>{n}</small>
              </button>
            );
          })}
        </div>
        <button
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-fog transition-colors hover:text-mist disabled:pointer-events-none disabled:opacity-0"
          type="button"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
        >
          <X size={13} aria-hidden /> Limpar filtros
        </button>
      </div>
    </div>
  );
}
