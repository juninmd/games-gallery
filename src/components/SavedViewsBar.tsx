import { Bookmark, BookmarkPlus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { isEmptyFilter, MAX_VIEWS } from "../domain/savedViews";
import { useSavedViews } from "../state/savedViews";
import { useUi } from "../state/ui";

/** Named shortcuts for filter combinations ("cozy curtos instalados"); stored on this machine and in the backup. */
export function SavedViewsBar() {
  const views = useSavedViews((s) => s.views);
  const save = useSavedViews((s) => s.save);
  const remove = useSavedViews((s) => s.remove);
  const filter = useUi((s) => s.filter);
  const setFilter = useUi((s) => s.setFilter);
  const toast = useUi((s) => s.toast);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const empty = isEmptyFilter(filter);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (save(name, filter)) toast(`Visão "${name.trim()}" salva`);
    else toast(views.length >= MAX_VIEWS ? "Limite de visões atingido" : "Não foi possível salvar esta visão");
    setName("");
    setNaming(false);
  };

  if (!views.length && empty && !naming) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Visões salvas">
      <Bookmark size={14} aria-hidden className="text-fog" />
      {views.map((v) => (
        <span key={v.id} className="inline-flex items-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04] text-xs font-medium">
          <button type="button" className="px-3 py-1.5 text-mist transition-colors hover:bg-white/[0.08]" onClick={() => setFilter(v.filter)}>{v.name}</button>
          <button type="button" aria-label={`Apagar a visão ${v.name}`} className="grid place-items-center px-2 py-1.5 text-fog transition-colors hover:bg-white/[0.08] hover:text-mist" onClick={() => remove(v.id)}>
            <X size={12} aria-hidden />
          </button>
        </span>
      ))}
      {naming ? (
        <form onSubmit={submit} className="flex items-center gap-2">
          <input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.currentTarget.value)} aria-label="Nome da visão" placeholder="Nome da visão" className="!w-44 !py-1.5 text-xs" />
          <button className="btn" type="submit" disabled={!name.trim()}>Salvar</button>
          <button className="btn ghost" type="button" onClick={() => { setNaming(false); setName(""); }}>Cancelar</button>
        </form>
      ) : (
        <button type="button" disabled={empty} onClick={() => setNaming(true)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-fog transition-colors hover:text-mist disabled:pointer-events-none disabled:opacity-40" title={empty ? "Escolha algum filtro para salvar" : undefined}>
          <BookmarkPlus size={13} aria-hidden /> Salvar filtro atual
        </button>
      )}
    </div>
  );
}
