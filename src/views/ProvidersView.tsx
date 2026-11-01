import { RefreshCw, Search } from "lucide-react";
import { ProgressBar } from "../components/Badges";
import { PROVIDERS } from "../domain/providers";
import type { ImportMethod, Provider, ProviderKind } from "../domain/types";
import { useLibrary } from "../state/library";
import { useSecrets } from "../state/secrets";
import { useTasks } from "../state/tasks";
import { useUi } from "../state/ui";
import { isValidSteamId, isValidSteamKey } from "../platform/steamApi";

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

/** Providers Rust can read from disk on this machine. The rest only exist with a login. */
const DETECTABLE = new Set(["steam", "epic", "gog", "itch", "amazon", "ubisoft", "rockstar", "ea", "battlenet", "xboxpc"]);

function ProviderCard({ provider }: { provider: Provider }) {
  const state = useLibrary((s) => s.providers[provider.id]);
  const count = useLibrary((s) => s.games.filter((g) => g.providerId === provider.id).length);
  const detect = useLibrary((s) => s.detect);
  const syncSteamApi = useLibrary((s) => s.syncSteamApi);
  const steamId = useSecrets((s) => s.steamId);
  const steamKey = useSecrets((s) => s.steamKey);
  const go = useUi((s) => s.go);
  const busy = useTasks((s) => s.tasks[`detect:${provider.id}`] ?? s.tasks["detect:all"] ?? s.tasks["sync:steam-api"]);
  const detectable = DETECTABLE.has(provider.id);
  const steamReady = provider.id === "steam" && isValidSteamId(steamId) && isValidSteamKey(steamKey);
  const connected = !!state?.connected;

  return (
    <article className="vcard">
      <div className="vcard-head">
        <i className="dot big" style={{ background: provider.color }} />
        <div>
          <h3>{provider.name}</h3>
          <span className="muted small">{METHOD_LABEL[provider.importMethod]}</span>
        </div>
        <span className={`tag ${connected ? "ok" : ""}`}>{connected ? "Lido do PC" : detectable ? "Não detectado" : "Requer login"}</span>
      </div>
      <p className="muted small">{provider.importNote}</p>
      {state?.note && !connected && <p className="muted small">{state.note}</p>}
      {busy && <ProgressBar value={busy.progress} label={busy.label} />}
      <div className="vcard-foot">
        <button className="link" onClick={() => go("library", { providerIds: [provider.id] })}>{count} jogos</button>
        <div className="actions">
          {detectable ? (
            <button className="btn" disabled={!!busy} onClick={() => void detect(provider.id)}>
              <Search size={14} aria-hidden /> Detectar agora
            </button>
          ) : (
            <span className="muted small">Só com login no serviço</span>
          )}
          {(provider.id === "epic" || provider.id === "amazon" || provider.id === "ea" || provider.id === "battlenet" || provider.id === "ubisoft") && (
            <button className="btn ghost" onClick={() => go("connections")}>Entrar na conta</button>
          )}
          {provider.id === "steam" && (
            <button
              className="btn ghost"
              disabled={!!busy || !steamReady}
              title={steamReady ? "IPlayerService/GetOwnedGames com sua chave" : "Informe SteamID64 e chave em Ajustes"}
              onClick={() => void syncSteamApi()}
            >
              <RefreshCw size={14} aria-hidden /> Sincronizar conta
            </button>
          )}
        </div>
      </div>
      {state?.lastSync && connected && (
        <span className="muted small">
          Última leitura: {new Date(state.lastSync).toLocaleString("pt-BR")}
          {state.source ? ` · ${state.source}` : ""}
        </span>
      )}
    </article>
  );
}

export function ProvidersView() {
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Provedores</h1>
          <p className="muted">
            Cada provedor é lido do próprio launcher instalado no computador (manifests, bancos SQLite e registro).
            Quem exige login só entra depois de você autenticar no serviço.
          </p>
        </div>
      </header>
      {(Object.keys(KIND_LABEL) as ProviderKind[]).map((kind) => (
        <section key={kind} className="section-group">
          <h2>{KIND_LABEL[kind]}</h2>
          <div className="cards wide">
            {PROVIDERS.filter((p) => p.kind === kind).map((p) => <ProviderCard key={p.id} provider={p} />)}
          </div>
        </section>
      ))}
    </>
  );
}
