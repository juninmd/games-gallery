import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CLEARED_FILTER, hasActiveFilter, type GameFilter } from "../../domain/filter";
import { absorbTokens, filterChips, parseSearchWord, SEARCH_SUGGESTIONS } from "../../domain/searchTokens";
import { useUi } from "../../state/ui";

const LIBRARY_VIEWS = new Set(["library", "installed"]);

/**
 * One box for every library filter: finished words like "ps2", "zerado" or "steam" become
 * removable chips, the rest searches titles, genres and tags. "/" focuses it.
 */
export function OmniSearch() {
  const view = useUi((s) => s.view);
  const filter = useUi((s) => s.filter);
  const setFilter = useUi((s) => s.setFilter);
  const go = useUi((s) => s.go);
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const inLibrary = LIBRARY_VIEWS.has(view);
  const chips = useMemo(() => (inLibrary ? filterChips(filter, view === "installed") : []), [filter, inLibrary, view]);

  /** Applies a patch, moving to the library first when typing from another screen. */
  const apply = (patch: Partial<GameFilter>) => {
    if (inLibrary) setFilter(patch);
    else go("library", { ...patch });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onChange = (text: string) => {
    const { patch, rest } = absorbTokens(text, filter);
    apply({ ...patch, query: rest });
  };

  const removeChip = (i: number, retype = false) => {
    const chip = chips[i];
    if (!chip) return;
    setFilter({ ...chip.clear, ...(retype ? { query: chip.word } : {}) });
    input.current?.focus();
  };

  const lastWord = (filter.query.split(/\s+/).pop() ?? "").toLowerCase();
  // Offer only words that would change something: no "ps2" while PS2 is already the platform.
  const suggestions = SEARCH_SUGGESTIONS.filter((w) => {
    if (!w.startsWith(lastWord)) return false;
    const patch = parseSearchWord(w, filter);
    return Boolean(patch) && Object.entries(patch!).some(([k, v]) => filter[k as keyof GameFilter] !== v);
  });
  const pick = (word: string) => {
    const words = filter.query.split(/\s+/).filter(Boolean);
    if (lastWord && word.startsWith(lastWord)) words.pop();
    onChange([...words, word].join(" ") + " ");
    input.current?.focus();
  };

  const query = inLibrary ? filter.query : "";
  const clearable = inLibrary && hasActiveFilter(filter);

  return (
    <div className={`omni ${focused ? "is-focused" : ""}`}>
      <Search size={17} aria-hidden className="omni-icon" />
      <ul className="omni-chips" aria-label="Filtros ativos">
        {chips.map((c, i) => (
          <li key={c.key} className="omni-chip" style={{ "--c": c.color } as React.CSSProperties}>
            <small>{c.kind}</small>{c.label}
            <button type="button" aria-label={`Remover filtro ${c.label}`} onClick={() => removeChip(i)}><X size={12} aria-hidden /></button>
          </li>
        ))}
      </ul>
      <input
        ref={input}
        type="search"
        value={query}
        placeholder={chips.length ? "Refinar…" : "Busque ou filtre: “ps2 zerado”, “steam instalado”, “#coop”…"}
        aria-label="Buscar e filtrar jogos"
        aria-describedby="omni-hint"
        autoComplete="off"
        spellCheck={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        onChange={(e) => onChange(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onChange(`${query} `); }
          else if (e.key === "Backspace" && !query && chips.length) { e.preventDefault(); removeChip(chips.length - 1, true); }
          else if (e.key === "Escape") e.currentTarget.blur();
        }}
      />
      <span id="omni-hint" className="sr-only">Palavras como plataforma, status, loja ou #tag viram filtros ao apertar espaço. Backspace no campo vazio desfaz o último.</span>
      {clearable ? (
        <button type="button" className="omni-clear" onClick={() => { setFilter(CLEARED_FILTER); input.current?.focus(); }}>
          Limpar
        </button>
      ) : <kbd className="omni-kbd" aria-hidden>/</kbd>}
      {focused && suggestions.length > 0 && (
        <div className="omni-suggest" role="group" aria-label="Filtros rápidos">
          <p>Filtros rápidos · digite e aperte espaço</p>
          {suggestions.map((w) => (
            <button key={w} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(w)}>{w}</button>
          ))}
        </div>
      )}
    </div>
  );
}
