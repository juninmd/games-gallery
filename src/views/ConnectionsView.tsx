import { AmazonAccountSettings } from "../components/AmazonAccountSettings";
import { EpicAccountSettings } from "../components/EpicAccountSettings";
import { ProbeList } from "../components/ProbeList";
import { WindowLoginSettings } from "../components/WindowLoginSettings";
import { RatingSourcesSettings } from "../components/RatingSourcesSettings";
import { SteamSettings } from "../components/SteamSettings";
import { PROVIDERS } from "../domain/providers";
import { useLibrary } from "../state/library";
import { useSecrets } from "../state/secrets";

function SteamReviewsToggle() {
  const { steamReviews, setSteamReviews } = useSecrets();
  return (
    <section className="panel narrow">
      <h3>Steam Reviews</h3>
      <p className="muted small">
        Nota pública (% de avaliações positivas) de <code>store.steampowered.com/appreviews</code>. Não precisa de chave.
        Vale para jogos com App ID da Steam.
      </p>
      <label className="inline">
        <input type="checkbox" checked={steamReviews} onChange={(e) => setSteamReviews(e.target.checked)} />
        Buscar a nota da Steam ao abrir um jogo
      </label>
    </section>
  );
}

/** What each launcher gave us on the last scan, so a missing source explains itself. */
function LocalSources() {
  const providers = useLibrary((s) => s.providers);
  const rows = PROVIDERS.filter((p) => providers[p.id]);
  return (
    <section className="panel narrow">
      <h3>Launchers neste PC</h3>
      {!rows.length && <p className="muted small">Nenhuma leitura ainda. Use “Detectar bibliotecas agora” em Ajustes.</p>}
      <ul className="plain sources">
        {rows.map((p) => {
          const st = providers[p.id];
          return (
            <li key={p.id}>
              <strong>{p.name}</strong> <span className={`tag ${st?.connected ? "ok" : ""}`}>{st?.connected ? "Lido" : "Indisponível"}</span>
              {st?.note && <div className="muted small">{st.note}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ConnectionsView() {
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Conexões</h1>
          <p className="muted">Chaves e fontes que alimentam a biblioteca, as notas e as promoções. Nada sai deste perfil além da API a que a chave pertence.</p>
        </div>
      </header>
      <ProbeList />
      <SteamSettings />
      <EpicAccountSettings />
      <AmazonAccountSettings />
      <WindowLoginSettings />
      <SteamReviewsToggle />
      <RatingSourcesSettings />
      <LocalSources />
    </>
  );
}
