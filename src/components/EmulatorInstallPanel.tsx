import { Copy, ExternalLink } from "lucide-react";
import { commandsFor, hostOs, isHttps } from "../domain/install";
import type { Emulator } from "../domain/types";
import { copyText } from "../platform/clipboard";
import { useUi } from "../state/ui";

const os = hostOs(typeof navigator === "undefined" ? "" : navigator.userAgent);

/** Official download link plus copyable package-manager commands, host OS first. */
export function EmulatorInstallPanel({ emulator: e }: { emulator: Emulator }) {
  const toast = useUi((s) => s.toast);
  const commands = commandsFor(e.install, os);
  const url = e.install?.downloadUrl;

  const copy = async (text: string) => toast((await copyText(text)) ? "Comando copiado" : "Não foi possível copiar: selecione o texto manualmente");

  return (
    <details className="install">
      <summary>Como instalar</summary>
      {url && isHttps(url) && (
        <a className="link" href={url} target="_blank" rel="noreferrer noopener"><ExternalLink size={13} aria-hidden /> Download oficial</a>
      )}
      {!commands.length && <p className="muted small">Sem pacote verificado em gerenciador: use o download oficial.</p>}
      {commands.map((c) => (
        <div key={c.manager} className="install-cmd">
          <span className="muted small">{c.label}</span>
          <pre className="cmd small">{c.command}</pre>
          <button className="btn ghost" onClick={() => copy(c.command)} aria-label={`Copiar comando ${c.label} de ${e.name}`}>
            <Copy size={13} aria-hidden /> Copiar
          </button>
        </div>
      ))}
    </details>
  );
}
