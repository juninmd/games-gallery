import { Gamepad2 } from "lucide-react";
import { useMemo, useState } from "react";
import { shortcutEntries } from "../domain/steamShortcuts";
import { steamAddShortcuts } from "../platform/native";
import { isTauri } from "../platform/runtime";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

/** Adds every launchable emulated game to Steam as a non-Steam shortcut (Big Picture, Steam Deck). */
export function SteamShortcutsSettings() {
  const games = useLibrary((s) => s.games);
  const emulators = useLibrary((s) => s.emulators);
  const emulatorPaths = useLibrary((s) => s.emulatorPaths);
  const toast = useUi((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const entries = useMemo(() => shortcutEntries(games, { installed: emulators, exePaths: emulatorPaths }), [games, emulators, emulatorPaths]);
  const native = isTauri();

  const run = async () => {
    setBusy(true);
    try {
      const { added, skipped, files } = await steamAddShortcuts(entries);
      toast(`${added} atalhos adicionados${skipped ? `, ${skipped} já existiam` : ""} em ${files.length} conta(s) da Steam. Abra a Steam para vê-los.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel narrow">
      <h3 aria-level={2}>Jogos emulados na Steam</h3>
      <p className="muted small">
        Adiciona cada jogo emulado que já abre por aqui como “jogo não Steam”, para jogar pelo Big Picture ou pelo Steam Deck.
        <strong> Feche a Steam antes</strong>: ela regrava a lista ao sair. Atalhos repetidos são ignorados e o arquivo anterior
        fica salvo como <code>shortcuts.vdf.bak</code>.
      </p>
      <div className="actions">
        <button className="btn" disabled={!native || busy || entries.length === 0} onClick={() => void run()} title={native ? undefined : "Só no app instalado"}>
          <Gamepad2 size={14} aria-hidden /> Adicionar {entries.length} jogo(s) à Steam
        </button>
      </div>
    </section>
  );
}
