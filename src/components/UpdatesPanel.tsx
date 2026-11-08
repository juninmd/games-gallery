import { Download, RefreshCw } from "lucide-react";
import { summarizeNotes } from "../domain/release";
import { openReleasePage } from "../platform/updates";
import { isTauri } from "../platform/runtime";
import { useUpdates } from "../state/updates";

/** Settings section: installed version, newest GitHub release, and install or download actions. */
export function UpdatesPanel() {
  const { phase, current, latest, canInstall, progress, error, checkedAt, auto, check, install, setAuto } = useUpdates();
  const busy = phase === "checking" || phase === "downloading" || phase === "restarting";

  return (
    <section className="panel narrow" aria-labelledby="updates-title">
      <h3 id="updates-title" aria-level={2}>Atualizações</h3>
      <p className="m-0">
        Versão instalada: <strong className="tabular-nums">v{current}</strong>
        <span className="muted small"> · {isTauri() ? "Desktop" : "Web"}</span>
      </p>

      <div aria-live="polite" className="grid gap-2">
        {phase === "checking" && <p className="muted m-0">Verificando as releases do GitHub…</p>}
        {phase === "current" && (
          <p className="m-0">{latest ? `Você está na versão mais recente (v${latest.version}).` : "Ainda não há release publicada no GitHub."}</p>
        )}
        {phase === "idle" && <p className="muted m-0">Ainda não verificado nesta sessão.</p>}
        {(phase === "available" || phase === "downloading" || phase === "restarting") && latest && (
          <>
            <p className="m-0"><strong>Nova versão disponível: v{latest.version}</strong></p>
            {latest.notes && <pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap font-sans rounded-xl bg-white/[0.04] p-3 text-[12.5px] leading-relaxed text-fog">{summarizeNotes(latest.notes)}</pre>}
          </>
        )}
        {phase === "downloading" && (
          <p className="m-0 flex items-center gap-3">
            <progress className="h-2 flex-1" max={1} value={progress ?? undefined} aria-label="Progresso do download" />
            <span className="tabular-nums text-sm text-fog">{progress === null ? "Baixando…" : `${Math.round(progress * 100)}%`}</span>
          </p>
        )}
        {phase === "restarting" && <p className="muted m-0">Atualização instalada. Reiniciando o app…</p>}
        {error && <p role="alert" className="m-0 text-rose">{phase === "error" ? "Não foi possível verificar: " : "Falha na atualização: "}{error}</p>}
      </div>

      {phase === "available" && !canInstall && (
        <p className="muted small m-0">
          {isTauri()
            ? "Este build não tem a chave de assinatura das atualizações automáticas. Baixe o instalador na página da release."
            : "No navegador não há instalação automática. Baixe o instalador na página da release."}
        </p>
      )}

      <div className="actions">
        {phase === "available" && canInstall && (
          <button type="button" className="btn primary" onClick={() => void install()}><Download size={14} aria-hidden /> Atualizar e reiniciar</button>
        )}
        {phase === "available" && !canInstall && latest && (
          <button type="button" className="btn primary" onClick={() => void openReleasePage(latest.url)}><Download size={14} aria-hidden /> Ver release no GitHub</button>
        )}
        <button type="button" className="btn" disabled={busy} onClick={() => void check()}><RefreshCw size={14} aria-hidden /> Verificar agora</button>
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        Verificar ao abrir o app (no máximo a cada 6 h)
      </label>
      {checkedAt !== null && <p className="muted small m-0">Última verificação: {new Date(checkedAt).toLocaleString("pt-BR")}</p>}
    </section>
  );
}
