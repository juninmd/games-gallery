import { Download, ExternalLink } from "lucide-react";
import { useRef, useState } from "react";
import { type AmazonDevice, buildAuthUrl, extractAuthorizationCode, newDevice } from "../domain/amazonAccount";
import { openExternal } from "../platform/runtime";
import { useLibrary } from "../state/library";
import { useTasks } from "../state/tasks";
import { useUi } from "../state/ui";

/**
 * Amazon Games keeps the purchased library on its servers. The login happens on amazon.com; the app
 * only receives the one-time code from the address you paste, reads the library once, and removes
 * the temporary device it registered. Nothing is stored.
 */
export function AmazonAccountSettings() {
  const sync = useLibrary((s) => s.syncAmazonAccount);
  const toast = useUi((s) => s.toast);
  const busy = useTasks((s) => !!s.tasks["sync:amazon-account"]);
  const device = useRef<AmazonDevice | null>(null);
  const [input, setInput] = useState("");
  const ready = !!extractAuthorizationCode(input) && !!device.current;

  const login = async () => {
    try {
      device.current = await newDevice();
      if (!(await openExternal(buildAuthUrl(device.current)))) toast("Link bloqueado: endereço fora da lista permitida");
    } catch (e) {
      toast(`Não foi possível abrir: ${String(e)}`);
    }
  };

  return (
    <section className="panel narrow">
      <h3 aria-level={2}>Amazon Games: biblioteca da conta</h3>
      <p className="muted small">
        Os instalados já vêm do launcher. Para listar também os comprados (inclui Prime Gaming), entre na sua conta: depois do
        login a Amazon te leva à página inicial; copie o endereço completo da barra do navegador e cole aqui.
        O app não guarda senha nem token e remove o dispositivo temporário ao terminar.
      </p>
      <ol className="plain small">
        <li><button className="btn" onClick={() => void login()}><ExternalLink size={14} aria-hidden /> Abrir login da Amazon</button></li>
        <li>Entre, e copie o endereço da página para onde você for levado.</li>
      </ol>
      <label>
        Endereço da página após o login
        <input type="password" autoComplete="off" value={input} placeholder="https://www.amazon.com/?openid…" onChange={(e) => setInput(e.target.value)} aria-invalid={!!input.trim() && !ready} />
      </label>
      {!!input.trim() && !extractAuthorizationCode(input) && <p className="warn-text small">Não achei o código nesse endereço. Copie a URL completa, depois do login.</p>}
      <div className="actions">
        <button
          className="btn primary"
          disabled={!ready || busy}
          onClick={() => { const d = device.current; if (d) { void sync(input, d); setInput(""); device.current = null; } }}
        >
          <Download size={14} aria-hidden /> {busy ? "Lendo…" : "Importar biblioteca"}
        </button>
      </div>
    </section>
  );
}
