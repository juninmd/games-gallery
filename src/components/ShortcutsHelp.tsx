import { useEffect } from "react";
import { useUi } from "../state/ui";
import { useNativeDialog } from "./useNativeDialog";

const mod = typeof navigator !== "undefined" && /mac/i.test(navigator.platform) ? "⌘" : "Ctrl";
const SHORTCUTS: [string[], string][] = [
  [[mod, "K"], "Abrir a paleta: telas, ações e jogos"],
  [["/"], "Ir para a busca da biblioteca"],
  [["?"], "Mostrar esta ajuda"],
  [["Esc"], "Fechar a janela ou o painel aberto"],
  [["←", "→"], "Trocar de aba no painel do jogo"],
];

/** Press ? anywhere outside a text field to see the keyboard shortcuts. */
export function ShortcutsHelp() {
  const open = useUi((s) => s.shortcutsOpen);
  const setOpen = useUi((s) => s.setShortcutsOpen);
  const dialog = useNativeDialog(open, () => setOpen(false));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      setOpen(!useUi.getState().shortcutsOpen);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  return (
    <dialog ref={dialog.ref} className="native-dialog border-0 bg-transparent p-0 text-mist open:block" aria-labelledby="shortcuts-title" onCancel={dialog.onCancel} onPointerDown={dialog.onPointerDown} onPointerUp={dialog.onPointerUp}>
      <div className="glass grid gap-4 rounded-3xl p-6" style={{ minWidth: "min(420px, 90vw)" }}>
        <h2 id="shortcuts-title" className="text-lg">Atalhos do teclado</h2>
        <dl className="m-0 grid gap-2.5">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={label} className="flex items-center justify-between gap-6">
              <dt className="flex gap-1.5">{keys.map((k) => <kbd key={k} className="rounded-md border border-white/15 bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-mist">{k}</kbd>)}</dt>
              <dd className="m-0 text-right text-sm text-fog">{label}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="btn" onClick={() => setOpen(false)}>Fechar</button>
      </div>
    </dialog>
  );
}
