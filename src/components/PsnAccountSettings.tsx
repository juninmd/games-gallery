import { Button, TextField } from "@juninmd/sonido";
import { Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import { extractNpsso } from "../domain/psnAccount";
import { openExternal } from "../platform/runtime";
import { useLibrary } from "../state/library";
import { useTasks } from "../state/tasks";
import { useUi } from "../state/ui";

const LOGIN_URL = "https://www.playstation.com/";
const NPSSO_URL = "https://ca.account.sony.com/api/v1/ssocookie";

/**
 * Sony has no public API. The user signs in on playstation.com, copies the NPSSO cookie and pastes it
 * here once; the app reads the played-games list (PS4/PS5) and forgets the token.
 */
export function PsnAccountSettings() {
  const sync = useLibrary((s) => s.syncPsnAccount);
  const toast = useUi((s) => s.toast);
  const busy = useTasks((s) => !!s.tasks["sync:psn-account"]);
  const [input, setInput] = useState("");
  const npsso = extractNpsso(input);

  const open = async (url: string) => {
    try {
      if (!(await openExternal(url))) toast("Link bloqueado: endereço fora da lista permitida");
    } catch (e) {
      toast(`Não foi possível abrir: ${String(e)}`);
    }
  };

  return (
    <section className="panel narrow">
      <h3 aria-level={2}>PlayStation Network: jogos jogados</h3>
      <p className="muted small">
        A Sony não tem API pública; este é o mesmo fluxo não oficial que o app PlayStation usa. Importa os jogos de
        PS4 e PS5 que você jogou, com as horas. O NPSSO é usado uma vez e não é salvo. Trate-o como senha.
      </p>
      <ol className="plain small">
        <li><Button variant="secondary" onClick={() => void open(LOGIN_URL)}><ExternalLink size={14} aria-hidden /> Entrar em playstation.com</Button></li>
        <li>Na mesma sessão do navegador, <Button variant="secondary" onClick={() => void open(NPSSO_URL)}><ExternalLink size={14} aria-hidden /> Abrir página do NPSSO</Button></li>
        <li>Copie o valor de <code>npsso</code> (ou a resposta JSON inteira).</li>
      </ol>
      <TextField label="NPSSO" type="password" autoComplete="off" value={input} placeholder="64 caracteres ou {“npsso”: …}" onChange={(e) => setInput(e.target.value)} aria-invalid={!!input.trim() && !npsso} />
      {!!input.trim() && !npsso && <p className="warn-text small">Não parece um NPSSO válido: são 64 letras e números.</p>}
      <div className="actions">
        <Button variant="primary" disabled={!npsso || busy} onClick={() => { if (npsso) { void sync(npsso); setInput(""); } }}>
          <Download size={14} aria-hidden /> {busy ? "Lendo…" : "Importar jogos"}
        </Button>
      </div>
    </section>
  );
}
