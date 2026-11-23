import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { FACET_SEARCH_MIN, matchFacets, type Facet } from "../domain/facets";

interface Props {
  title: string;
  facets: Facet[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Swatch shown when the facet has no cover. */
  colorOf?: (id: string) => string | undefined;
}

/** Single-choice filter list: 40px rows with a cover thumbnail and the game count; searchable once it is long. */
export function FacetList({ title, facets, selected, onSelect, colorOf }: Props) {
  const [query, setQuery] = useState("");
  const headingId = useId();
  const shown = useMemo(() => matchFacets(facets, query), [facets, query]);
  if (!facets.length) return null;

  return (
    <section className="facet" aria-labelledby={headingId}>
      <h3 id={headingId} className="facet-title">{title}</h3>
      {facets.length > FACET_SEARCH_MIN && (
        <label className="facet-search">
          <Search size={13} aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Buscar ${title.toLowerCase()}`} aria-label={`Buscar ${title.toLowerCase()}`} />
        </label>
      )}
      <ul className="facet-rows">
        {shown.map((f) => {
          const on = f.id === selected;
          return (
            <li key={f.id}>
              <button type="button" className="facet-row" aria-pressed={on} onClick={() => onSelect(on ? null : f.id)}>
                {f.thumb
                  ? <img className="facet-thumb" src={f.thumb} alt="" loading="lazy" decoding="async" />
                  : <span className="facet-thumb" style={{ background: colorOf?.(f.id) ?? "var(--glass-2)" }} aria-hidden />}
                <span className="facet-label">{f.label}</span>
                <span className="facet-count">{f.count}</span>
              </button>
            </li>
          );
        })}
        {!shown.length && <li className="facet-empty muted small">Nada encontrado.</li>}
      </ul>
    </section>
  );
}
