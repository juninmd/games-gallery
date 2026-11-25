import { Button, TextField } from "@juninmd/sonido";
import { RefreshCw, Save } from "lucide-react";
import { useDraft } from "./useDraft";
import { useLibrary } from "../state/library";
import { useSecrets } from "../state/secrets";
import { isValidSteamId, isValidSteamKey } from "../platform/steamApi";
import { isValidSteamToken, STEAM_TOKEN_HELP_URL, STEAM_TOKEN_MAX } from "../platform/steamFamily";
import { useUi } from "../state/ui";
import { openExternal } from "../platform/runtime";

/**
 * Steam Web API credentials. The local manifests already prove what is installed; the API adds the
 * rest of the account (owned but not installed) plus total playtime.
 */
export function SteamSettings() {
  const { steamId, steamKey, steamToken, setSteam, setSteamToken } = useSecrets();
  const syncSteamApi = useLibrary((s) => s.syncSteamApi);
  const toast = useUi((s) => s.toast);
  const [id, setId, resetId] = useDraft(steamId);
  const [key, setKey, resetKey] = useDraft(steamKey);
  const [token, setToken, resetToken] = useDraft(steamToken);

  const idOk = !id.trim() || isValidSteamId(id);
  const keyOk = !key.trim() || isValidSteamKey(key);
  const tokenOk = !token.trim() || isValidSteamToken(token);
  const ready = isValidSteamId(id) && isValidSteamKey(key) && tokenOk;

  return (
    <section className="panel narrow">
      <h3 aria-level={2}>Steam Web API (opcional)</h3>
      <p className="muted small">
        A biblioteca instalada já é lida dos <code>appmanifest_*.acf</code>. Com SteamID64 e chave,
        o app também lista os jogos da conta que não estão instalados e traz as horas jogadas.
      </p>
      <TextField label="SteamID64" value={id} maxLength={17} inputMode="numeric" placeholder="7656119…" onChange={(e) => setId(e.target.value)} aria-invalid={!idOk} />
      {!idOk && <p className="warn-text small">São 17 dígitos. Pegue o seu em steamid.io.</p>}
      <TextField label="Chave da Web API" type="password" autoComplete="off" value={key} maxLength={32} placeholder="32 caracteres hexadecimais" onChange={(e) => setKey(e.target.value)} aria-invalid={!keyOk} />
      {!keyOk && <p className="warn-text small">A chave tem 32 caracteres hexadecimais (A-F, 0-9).</p>}
      <TextField label="Token de acesso (Família Steam, opcional)" type="password" autoComplete="off" value={token} maxLength={STEAM_TOKEN_MAX} placeholder="eyJ…" onChange={(e) => setToken(e.target.value)} aria-invalid={!tokenOk} aria-describedby="steam-token-help" />
      <p id="steam-token-help" className="muted small">
        Para incluir os jogos compartilhados da família: logado na Steam, abra{" "}
        <button type="button" className="link" onClick={() => void openExternal(STEAM_TOKEN_HELP_URL)}>ajaxgetasyncconfig</button> e copie o valor de{" "}
        <code>webapi_token</code>. Ele expira em cerca de 24 h; não compartilhe.
      </p>
      {!tokenOk && <p className="warn-text small">O token é um JWT (três partes separadas por ponto).</p>}
      <div className="actions">
        <Button
          variant="secondary"
          disabled={!ready}
          onClick={() => { void Promise.all([setSteam({ steamId: id, steamKey: key }), setSteamToken(token)]).then(() => { resetId(); resetKey(); resetToken(); toast("Credenciais da Steam salvas no cofre do sistema"); }, () => toast("Não foi possível salvar no cofre do sistema")); }}
        >
          <Save size={14} aria-hidden /> Salvar
        </Button>
        <Button variant="primary" disabled={!ready} onClick={() => void syncSteamApi()}>
          <RefreshCw size={14} aria-hidden /> Sincronizar conta
        </Button>
      </div>
    </section>
  );
}
