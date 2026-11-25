import { OmniSearch as SonidoOmniSearch, type OmniChip } from "@juninmd/sonido";
import { useMemo } from "react";
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
  const inLibrary = LIBRARY_VIEWS.has(view);
  const chips = useMemo(() => (inLibrary ? filterChips(filter, view === "installed") : []), [filter, inLibrary, view]);

  /** Applies a patch, moving to the library first when typing from another screen. */
  const apply = (patch: Partial<GameFilter>) => {
    if (inLibrary) setFilter(patch);
    else go("library", { ...patch });
  };

  const onChange = (text: string) => {
    const { patch, rest } = absorbTokens(text, filter);
    apply({ ...patch, query: rest });
  };

  const removeChip = (omni: OmniChip, { retype }: { retype: boolean }) => {
    const chip = chips.find((c) => c.key === omni.key);
    if (chip) setFilter({ ...chip.clear, ...(retype ? { query: chip.word } : {}) });
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
  };

  const query = inLibrary ? filter.query : "";
  const clearable = inLibrary && hasActiveFilter(filter);

  return (
    <SonidoOmniSearch
      className="omni"
      label="Buscar e filtrar jogos"
      value={query}
      onChange={onChange}
      onSubmit={() => onChange(`${query} `)}
      chips={chips.map((c) => ({ key: c.key, label: c.label, kind: c.kind, color: c.color }))}
      onRemoveChip={removeChip}
      onClear={clearable ? () => setFilter(CLEARED_FILTER) : undefined}
      suggestions={suggestions}
      onPickSuggestion={pick}
      suggestionsLabel="Filtros rápidos"
      suggestionsTitle="Filtros rápidos · digite e aperte espaço"
      hint="Palavras como plataforma, status, loja ou #tag viram filtros ao apertar espaço. Backspace no campo vazio desfaz o último."
      placeholder={chips.length ? "Refinar…" : "Busque ou filtre: “ps2 zerado”, “steam instalado”, “#coop”…"}
    />
  );
}
