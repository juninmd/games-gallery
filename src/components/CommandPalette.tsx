import { CornerDownLeft, Gamepad2, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createGameQueryMatcher } from "../domain/filter";
import { PLATFORM_BY_ID } from "../domain/platforms";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";
import { NAV_GROUPS } from "./nav";
import { useNativeDialog } from "./useNativeDialog";

interface Item { id: string; group: string; label: string; hint?: string; icon: ReactNode; run: () => void }

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const MAX_GAMES = 8;

/** Ctrl/⌘+K: jump to any screen, add a game or open a title without leaving the keyboard. */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const go = useUi((s) => s.go);
  const select = useUi((s) => s.select);
  const setAddOpen = useUi((s) => s.setAddOpen);
  const games = useLibrary((s) => s.games);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const close = () => setOpen(false);
  const dialog = useNativeDialog(open, close);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUi.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => { if (open) { setQuery(""); setActive(0); } }, [open]);

  const items = useMemo<Item[]>(() => {
    const q = fold(query.trim());
    const base: Item[] = [
      { id: "add", group: "Ações", label: "Adicionar jogo", hint: "novo", icon: <Plus size={17} />, run: () => setAddOpen(true) },
      ...NAV_GROUPS.flatMap((g) => g.items.map((n) => ({
        id: `go:${n.view}`, group: "Ir para", label: n.label, hint: g.title, icon: n.icon, run: () => go(n.view),
        keywords: n.keywords ?? "",
      }))),
    ].filter((i) => !q || fold(`${i.label} ${"keywords" in i ? i.keywords : ""}`).includes(q));
    if (!q) return base;
    const match = createGameQueryMatcher(query);
    const found = games.filter(match).slice(0, MAX_GAMES).map<Item>((g) => ({
      id: `game:${g.id}`, group: "Jogos", label: g.title,
      hint: PLATFORM_BY_ID[g.platformId]?.short, icon: <Gamepad2 size={17} />, run: () => select(g.id),
    }));
    return [...base, ...found];
  }, [query, games, go, select, setAddOpen]);

  const clamped = Math.min(active, Math.max(0, items.length - 1));
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [clamped, items]);

  const run = (item: Item | undefined) => {
    if (!item) return;
    close();
    item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((clamped + 1) % Math.max(1, items.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((clamped - 1 + items.length) % Math.max(1, items.length)); }
    else if (e.key === "Enter") { e.preventDefault(); run(items[clamped]); }
  };

  let lastGroup = "";
  return (
    <dialog
      ref={dialog.ref}
      aria-label="Paleta de comandos"
      className="native-dialog m-0 mx-auto mt-[11vh] mb-auto w-[min(640px,92vw)] overflow-hidden rounded-3xl border border-white/10 bg-ink-800/95 p-0 text-mist shadow-lift backdrop-blur-2xl open:animate-rise"
      onCancel={dialog.onCancel}
      onPointerDown={dialog.onPointerDown}
      onPointerUp={dialog.onPointerUp}
    >
      <div className="flex items-center gap-3 border-b border-white/[0.07] px-5">
        <input
          role="combobox"
          aria-expanded
          aria-controls="palette-list"
          aria-activedescendant={items[clamped] ? `palette-${items[clamped].id}` : undefined}
          aria-label="Buscar telas, ações e jogos"
          autoFocus
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          placeholder="Buscar telas, ações e jogos…"
          className="min-w-0 flex-1 !rounded-none !border-0 !bg-transparent !px-0 py-5 text-[17px] !shadow-none focus:!ring-0"
        />
        <kbd className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-fog">Esc</kbd>
      </div>
      <ul id="palette-list" role="listbox" ref={listRef} className="m-0 max-h-[52vh] list-none overflow-y-auto p-2">
        {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-fog">Nada encontrado para “{query}”.</li>}
        {items.map((item, i) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          const on = i === clamped;
          return (
            <li key={item.id} role="presentation">
              {header && <div className="px-3 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-fog/70">{header}</div>}
              <div
                id={`palette-${item.id}`}
                role="option"
                aria-selected={on}
                onPointerMove={() => setActive(i)}
                onClick={() => run(item)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${on ? "bg-gradient-to-r from-rose/25 to-orchid/10 text-mist" : "text-fog"}`}
              >
                <span className={on ? "text-rose" : ""}>{item.icon}</span>
                <span className="flex-1 truncate font-medium">{item.label}</span>
                {item.hint && <span className="text-xs text-fog/70">{item.hint}</span>}
                {on && <CornerDownLeft size={14} className="text-fog" aria-hidden />}
              </div>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
