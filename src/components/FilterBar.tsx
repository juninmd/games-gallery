import { Search } from "lucide-react";
import { useMemo } from "react";
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

export function FilterBar({ lockInstalled = false }: { lockInstalled?: boolean }) {
  const { filter, setFilter } = useUi();
  const games = useLibrary((s) => s.games);

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

  return (
    <div className="filters">
      <div className="filter-row">
        <label className="search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            placeholder="Buscar por título ou gênero…"
            value={filter.query}
            onChange={(e) => setFilter({ query: e.target.value })}
            aria-label="Buscar jogos"
          />
        </label>
        <select aria-label="Plataforma" value={filter.platformId ?? ""} onChange={(e) => setFilter({ platformId: e.target.value || null })}>
          <option value="">Todas as plataformas</option>
          {(Object.keys(FAMILY_LABEL) as (keyof typeof FAMILY_LABEL)[]).map((fam) => (
            <optgroup key={fam} label={FAMILY_LABEL[fam]}>
              {PLATFORMS.filter((p) => p.family === fam).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select aria-label="Status" value={filter.status ?? ""} onChange={(e) => setFilter({ status: (e.target.value || null) as PlayStatus | null })}>
          <option value="">Qualquer status</option>
          {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select aria-label="Ordenar" value={filter.sort} onChange={(e) => setFilter({ sort: e.target.value as SortKey })}>
          {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {!lockInstalled && (
          <label className="check">
            <input type="checkbox" checked={filter.installedOnly} onChange={(e) => setFilter({ installedOnly: e.target.checked })} />
            Só instalados
          </label>
        )}
        <label className="check">
          <input type="checkbox" checked={filter.ownedOnly} onChange={(e) => setFilter({ ownedOnly: e.target.checked })} />
          Só comprados
        </label>
      </div>
      <div className="chips" role="group" aria-label="Provedores">
        {providerCounts.map(([id, n]) => {
          const p = PROVIDER_BY_ID[id];
          const on = filter.providerIds.includes(id);
          return (
            <button key={id} className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggleProvider(id)}>
              <i className="dot" style={{ background: p?.color }} />
              {p?.name ?? id} <small>{n}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
