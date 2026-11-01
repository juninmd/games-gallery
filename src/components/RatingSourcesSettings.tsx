import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useSecrets } from "../state/secrets";
import { useUi } from "../state/ui";

interface Source {
  name: string;
  access: string;
  state: "ready" | "key" | "phase2";
}

const SOURCES: Source[] = [
  { name: "Steam Reviews", access: "Pública, sem chave (% de avaliações positivas)", state: "ready" },
  { name: "RAWG (inclui nota do Metacritic)", access: "Chave gratuita em rawg.io/apidocs", state: "key" },
  { name: "IGDB", access: "Client ID + secret da Twitch; o token só pode ser obtido no backend Rust", state: "phase2" },
  { name: "OpenCritic", access: "Chave via RapidAPI; chamada pelo backend Rust", state: "phase2" },
  { name: "Metacritic direto", access: "Sem API pública; só pelo campo do RAWG (scraping viola os termos)", state: "phase2" },
];

const STATE_LABEL = { ready: "Ativo", key: "Precisa de chave", phase2: "Fase 2" } as const;

export function RatingSourcesSettings() {
  const rawgKey = useSecrets((s) => s.rawgKey);
  const setRawgKey = useSecrets((s) => s.setRawgKey);
  const toast = useUi((s) => s.toast);
  const [draft, setDraft] = useState(rawgKey);
  useEffect(() => setDraft(rawgKey), [rawgKey]);

  const save = () =>
    setRawgKey(draft).then(
      () => toast(draft.trim() ? "Chave do RAWG salva no cofre do sistema" : "Chave do RAWG removida"),
      () => toast("Não foi possível salvar no cofre do sistema"),
    );

  return (
    <section className="panel narrow">
      <h3>Fontes de nota</h3>
      <ul className="plain sources">
        {SOURCES.map((s) => (
          <li key={s.name}>
            <strong>{s.name}</strong> <span className={`tag ${s.state === "ready" ? "ok" : s.state === "key" ? "warn" : ""}`}>{STATE_LABEL[s.state]}</span>
            <div className="muted small">{s.access}</div>
          </li>
        ))}
      </ul>
      <label>
        Chave da API do RAWG
        <input type="password" autoComplete="off" value={draft} maxLength={64} placeholder="cole a chave aqui" onChange={(e) => setDraft(e.target.value)} />
      </label>
      <div className="actions">
        <button className="btn" disabled={draft.trim() === rawgKey} onClick={() => void save()}>
          <Save size={14} aria-hidden /> Salvar
        </button>
      </div>
      <p className="muted small">
        A chave fica no cofre do sistema (Gerenciador de Credenciais do Windows), não no armazenamento do app, e só é enviada
        para a api.rawg.io quando você abre as notas de um jogo. No navegador (modo dev) ela vale só para a sessão.
      </p>
    </section>
  );
}
