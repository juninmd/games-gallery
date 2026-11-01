import { ExternalLink, Download } from "lucide-react";
import { useState } from "react";
import { extractAuthCode } from "../domain/epicAccount";
import { EPIC_LOGIN_URL } from "../platform/epicAccount";
import { openExternal } from "../platform/runtime";
import { useLibrary } from "../state/library";
import { useTasks } from "../state/tasks";
import { useUi } from "../state/ui";

/**
 * Epic keeps the purchased library on its servers, not on disk. The login happens on Epic's own
 * page; the app only receives a one-time code, reads the library once and revokes the session.
 */
export function EpicAccountSettings() {
  const sync = useLibrary((s) => s.syncEpicAccount);
  const toast = useUi((s) => s.toast);
  const busy = useTasks((s) => !!s.tasks["sync:epic-account"]);
  const [input, setInput] = useState("");
  const code = extractAuthCode(input);

  const login = async () => {
    try {
      if (!(await openExternal(EPIC_LOGIN_URL))) toast("Link bloqueado: endereço fora da lista permitida");
    } catch (e) {
      toast(`Não foi possível abrir: ${String(e)}`);
    }
  };

  return (
    <section className="panel narrow">
      <h3 aria-level={2}>Epic Games: biblioteca da conta</h3>
      <p className="muted small">
        Os jogos instalados já vêm dos manifests do launcher. Para listar também os comprados, entre na sua conta:
        a página da Epic mostra um código de uso único, que você cola aqui. O app não guarda senha nem token
        e encerra a sessão logo após a leitura.
      </p>
      <ol className="plain small">
        <li>
          <button className="btn" onClick={() => void login()}><ExternalLink size={14} aria-hidden /> Abrir login da Epic</button>
        </li>
        <li>Copie o código (ou a resposta JSON inteira) que a página mostrar.</li>
      </ol>
      <label>
        Código de autorização
        <input type="password" autoComplete="off" value={input} placeholder="32 caracteres ou {“authorizationCode”: …}" onChange={(e) => setInput(e.target.value)} aria-invalid={!!input.trim() && !code} />
      </label>
      {!!input.trim() && !code && <p className="warn-text small">Não parece um código válido: são 32 caracteres hexadecimais.</p>}
      <div className="actions">
        <button className="btn primary" disabled={!code || busy} onClick={() => { if (code) { void sync(code); setInput(""); } }}>
          <Download size={14} aria-hidden /> {busy ? "Lendo…" : "Importar biblioteca"}
        </button>
      </div>
    </section>
  );
}
