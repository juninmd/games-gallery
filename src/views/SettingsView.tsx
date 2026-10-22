import { RatingSourcesSettings } from "../components/RatingSourcesSettings";
import { EMULATORS } from "../domain/emulators";
import { PLATFORMS } from "../domain/platforms";
import { PROVIDERS } from "../domain/providers";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

const MOCKED = [
  "Conexão e sincronização com lojas (Steam, GOG, Epic… são botões simulados)",
  "Instalação de jogos e de emuladores (barra de progresso falsa)",
  "Execução de emuladores — mostra o comando exato (exe + argv), mas não executa",
];
const REAL = [
  "Navegação, filtros, busca sem acento, ordenação, kanban com drag & drop",
  `Catálogo de ${PLATFORMS.length} plataformas, ${PROVIDERS.length} provedores e ${EMULATORS.length} emuladores (com mapa plataforma → emulador)`,
  "Capas reais (Steam CDN e libretro) com fallback gerado",
  "Notas públicas reais: Steam Reviews (sem chave) e RAWG/Metacritic (com chave), cache de 24h",
  "Varredura de pastas: ROMs por plataforma/extensão e bibliotecas Steam (appmanifest), com revisão antes de importar",
  "Montagem segura do launch: argv em array, ID de loja validado, sem shell",
  "Persistência local (localStorage no browser; fase 2: SQLite no Tauri)",
];

export function SettingsView() {
  const { settings, setSettings, reset } = useLibrary();
  const toast = useUi((s) => s.toast);

  return (
    <>
      <header className="page-head"><div><h1>Ajustes</h1></div></header>
      <section className="panel narrow">
        <h3>Pastas</h3>
        <label>Pasta de ROMs / ISOs<input value={settings.romsDir} onChange={(e) => setSettings({ romsDir: e.target.value })} /></label>
        <label>Pasta de emuladores<input value={settings.emulatorsDir} onChange={(e) => setSettings({ emulatorsDir: e.target.value })} /></label>
        <p className="muted small">Para varrer e importar, use a tela “Pastas”. Identificação por hash (No-Intro/Redump): fase 2.</p>
      </section>
      <RatingSourcesSettings />
      <section className="panel narrow">
        <h3>Sobre este protótipo</h3>
        <h4>O que é real</h4>
        <ul className="plain">{REAL.map((x) => <li key={x}>{x}</li>)}</ul>
        <h4>O que é simulado</h4>
        <ul className="plain">{MOCKED.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>
      <section className="panel narrow">
        <h3>Dados de demonstração</h3>
        <button className="btn ghost danger" onClick={() => {
          if (!window.confirm("Isso apaga os jogos que você adicionou e restaura os dados de demonstração. Continuar?")) return;
          reset();
          toast("Dados de demonstração restaurados");
        }}>Restaurar dados de demonstração</button>
      </section>
    </>
  );
}
