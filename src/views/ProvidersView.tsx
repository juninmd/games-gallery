import { RefreshCw } from "lucide-react";
import { ProgressBar } from "../components/Badges";
import { PROVIDERS } from "../domain/providers";
import type { ImportMethod, Provider, ProviderKind } from "../domain/types";
import { useLibrary } from "../state/library";
import { useTasks } from "../state/tasks";
import { useUi } from "../state/ui";

const KIND_LABEL: Record<ProviderKind, string> = {
  "pc-store": "Lojas de PC",
  "console-service": "Serviços de console",
  aggregator: "Agregadores",
  local: "Local / físico",
};
const METHOD_LABEL: Record<ImportMethod, string> = {
  oauth: "Login (OAuth)",
  "api-key": "Chave de API",
  "local-scan": "Varredura local",
  manual: "Manual",
};

function ProviderCard({ provider }: { provider: Provider }) {
  const state = useLibrary((s) => s.providers[provider.id]);
  const count = useLibrary((s) => s.games.filter((g) => g.providerId === provider.id).length);
  const { connectProvider, disconnectProvider, syncProvider } = useLibrary();
  const go = useUi((s) => s.go);
  const busy = useTasks((s) => s.tasks[`conn:${provider.id}`] ?? s.tasks[`sync:${provider.id}`]);
  const connected = !!state?.connected;

  return (
    <article className="vcard">
      <div className="vcard-head">
        <i className="dot big" style={{ background: provider.color }} />
        <div>
          <h3>{provider.name}</h3>
          <span className="muted small">{METHOD_LABEL[provider.importMethod]}</span>
        </div>
        <span className={`tag ${connected ? "ok" : ""}`}>{connected ? "Conectado" : "Desconectado"}</span>
      </div>
      <p className="muted small">{provider.importNote}</p>
      {busy && <ProgressBar value={busy.progress} label={busy.label} />}
      <div className="vcard-foot">
        <button className="link" onClick={() => go("library", { providerIds: [provider.id] })}>{count} jogos</button>
        <div className="actions">
          {connected ? (
            <>
              <button className="btn" disabled={!!busy} onClick={() => syncProvider(provider.id)}><RefreshCw size={14} aria-hidden /> Sincronizar</button>
              <button className="btn ghost" disabled={!!busy} onClick={() => disconnectProvider(provider.id)}>Desconectar</button>
            </>
          ) : (
            <button className="btn primary" disabled={!!busy} onClick={() => connectProvider(provider.id)}>Conectar</button>
          )}
        </div>
      </div>
      {state?.lastSync && connected && <span className="muted small">Última sync: {new Date(state.lastSync).toLocaleString("pt-BR")}</span>}
    </article>
  );
}

export function ProvidersView() {
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Provedores</h1>
          <p className="muted">Lojas e serviços de onde a biblioteca é importada. No protótipo, conectar e sincronizar são simulados.</p>
        </div>
      </header>
      {(Object.keys(KIND_LABEL) as ProviderKind[]).map((kind) => (
        <section key={kind} className="group">
          <h2>{KIND_LABEL[kind]}</h2>
          <div className="cards wide">
            {PROVIDERS.filter((p) => p.kind === kind).map((p) => <ProviderCard key={p.id} provider={p} />)}
          </div>
        </section>
      ))}
    </>
  );
}
