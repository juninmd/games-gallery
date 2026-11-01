import { RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useLibrary } from "../state/library";
import { useSecrets } from "../state/secrets";
import { isValidSteamId, isValidSteamKey } from "../platform/steamApi";
import { useUi } from "../state/ui";

/**
 * Steam Web API credentials. The local manifests already prove what is installed; the API adds the
 * rest of the account (owned but not installed) plus total playtime.
 */
export function SteamSettings() {
  const { steamId, steamKey, setSteam } = useSecrets();
  const syncSteamApi = useLibrary((s) => s.syncSteamApi);
  const toast = useUi((s) => s.toast);
  const [id, setId] = useState(steamId);
  const [key, setKey] = useState(steamKey);

  useEffect(() => { setId(steamId); setKey(steamKey); }, [steamId, steamKey]);

  const idOk = !id.trim() || isValidSteamId(id);
  const keyOk = !key.trim() || isValidSteamKey(key);
  const ready = isValidSteamId(id) && isValidSteamKey(key);

  return (
    <section className="panel narrow">
      <h3 aria-level={2}>Steam Web API (opcional)</h3>
      <p className="muted small">
        A biblioteca instalada já é lida dos <code>appmanifest_*.acf</code>. Com SteamID64 e chave,
        o app também lista os jogos da conta que não estão instalados e traz as horas jogadas.
      </p>
      <label>
        SteamID64
        <input value={id} maxLength={17} inputMode="numeric" placeholder="7656119…" onChange={(e) => setId(e.target.value)} aria-invalid={!idOk} />
      </label>
      {!idOk && <p className="warn-text small">São 17 dígitos. Pegue o seu em steamid.io.</p>}
      <label>
        Chave da Web API
        <input type="password" autoComplete="off" value={key} maxLength={32} placeholder="32 caracteres hexadecimais" onChange={(e) => setKey(e.target.value)} aria-invalid={!keyOk} />
      </label>
      {!keyOk && <p className="warn-text small">A chave tem 32 caracteres hexadecimais (A-F, 0-9).</p>}
      <div className="actions">
        <button
          className="btn"
          disabled={!ready}
          onClick={() => { void setSteam({ steamId: id, steamKey: key }).then(() => toast("Credenciais da Steam salvas no cofre do sistema"), () => toast("Não foi possível salvar no cofre do sistema")); }}
        >
          <Save size={14} aria-hidden /> Salvar
        </button>
        <button className="btn primary" disabled={!ready} onClick={() => void syncSteamApi()}>
          <RefreshCw size={14} aria-hidden /> Sincronizar conta
        </button>
      </div>
    </section>
  );
}
