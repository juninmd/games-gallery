import { ImageDown, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { SGDB_KEY } from "../platform/steamGridDb";
import { fetchMissingCovers, MAX_COVERS_PER_RUN, missingCovers } from "../state/covers";
import { useLibrary } from "../state/library";
import { useSecrets } from "../state/secrets";
import { useUi } from "../state/ui";

export function CoverSourceSettings() {
  const sgdbKey = useSecrets((s) => s.sgdbKey);
  const setSgdbKey = useSecrets((s) => s.setSgdbKey);
  const missing = useLibrary((s) => missingCovers(s.games).length);
  const toast = useUi((s) => s.toast);
  const [draft, setDraft] = useState(sgdbKey);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(sgdbKey), [sgdbKey]);
  const valid = !draft.trim() || SGDB_KEY.test(draft.trim());

  const save = () =>
    setSgdbKey(draft).then(
      () => toast(draft.trim() ? "Chave do SteamGridDB salva no cofre do sistema" : "Chave do SteamGridDB removida"),
      () => toast("Não foi possível salvar no cofre do sistema"),
    );

  const run = async () => {
    setBusy(true);
    try {
      const { found, tried } = await fetchMissingCovers();
      toast(`SteamGridDB: ${found} capas novas de ${tried} jogos`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel narrow">
      <h3 aria-level={2}>Capas</h3>
      <p className="muted small">
        No app instalado, cada capa é baixada uma vez para a pasta de cache e passa a funcionar offline. Com uma chave gratuita do
        SteamGridDB (steamgriddb.com, em Preferências, API), dá para preencher as capas que faltam.
      </p>
      <label>
        Chave da API do SteamGridDB
        <input type="password" autoComplete="off" value={draft} maxLength={64} placeholder="cole a chave aqui" aria-invalid={!valid} onChange={(e) => setDraft(e.target.value)} />
      </label>
      {!valid && <p className="small text-warn">A chave tem só letras e números.</p>}
      <div className="actions">
        <button className="btn" disabled={!valid || draft.trim() === sgdbKey} onClick={() => void save()}>
          <Save size={14} aria-hidden /> Salvar
        </button>
        <button className="btn" disabled={!sgdbKey || busy || missing === 0} onClick={() => void run()}>
          <ImageDown size={14} aria-hidden /> Buscar capas que faltam ({Math.min(missing, MAX_COVERS_PER_RUN)})
        </button>
      </div>
      <p className="muted small">A chave fica no cofre do sistema e só é enviada para www.steamgriddb.com.</p>
    </section>
  );
}
