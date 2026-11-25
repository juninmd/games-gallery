import { Button, Dialog, Kbd } from "@juninmd/sonido";
import { useEffect } from "react";
import { useUi } from "../state/ui";

const mod = typeof navigator !== "undefined" && /mac/i.test(navigator.platform) ? "⌘" : "Ctrl";
const SHORTCUTS: [string[], string][] = [
  [[mod, "K"], "Abrir a paleta: telas, ações e jogos"],
  [["/"], "Ir para a busca inteligente"],
  [["1", "…", "8"], "Trocar de tela pelo dock"],
  [["G"], "Alternar Trilhos, Grade, Compacta, Lista e Caixas"],
  [["⌫"], "Na busca vazia, desfazer o último filtro"],
  [["?"], "Mostrar esta ajuda"],
  [["Esc"], "Fechar a janela ou o painel aberto"],
  [["←", "→"], "Trocar de aba no painel do jogo"],
  [["🎮"], "Controle: direcional move, A abre, B volta, Start abre a paleta"],
];

/** Press ? anywhere outside a text field to see the keyboard shortcuts. */
export function ShortcutsHelp() {
  const open = useUi((s) => s.shortcutsOpen);
  const setOpen = useUi((s) => s.setShortcutsOpen);
  const close = () => setOpen(false);

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
    <Dialog open={open} onClose={close} title="Atalhos do teclado" footer={<Button variant="secondary" onClick={close}>Fechar</Button>}>
      <dl className="m-0 grid gap-2.5">
        {SHORTCUTS.map(([keys, label]) => (
          <div key={label} className="flex items-center justify-between gap-6">
            <dt className="flex gap-1.5">{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</dt>
            <dd className="m-0 text-right text-sm text-fog">{label}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
