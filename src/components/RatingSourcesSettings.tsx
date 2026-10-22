import { useSecrets } from "../state/ratings";

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
  const { rawgKey, setRawgKey } = useSecrets();
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
        <input type="password" autoComplete="off" value={rawgKey} placeholder="cole a chave aqui" onChange={(e) => setRawgKey(e.target.value)} />
      </label>
      <p className="muted small">A chave fica só em memória nesta sessão (não é gravada em disco). No app nativo ela irá para o chaveiro do sistema.</p>
    </section>
  );
}
