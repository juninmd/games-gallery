import { FolderSearch, FolderOpen, RefreshCw } from "lucide-react";
import { BackupSettings } from "../components/BackupSettings";
import { UpdatesPanel } from "../components/UpdatesPanel";
import { EMULATORS } from "../domain/emulators";
import { PLATFORMS } from "../domain/platforms";
import { PROVIDERS } from "../domain/providers";
import { pickDirectory } from "../platform/folders";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

const REAL = [
  "Bibliotecas lidas dos launchers instalados: appmanifest da Steam (todas as bibliotecas), manifests .item da Epic, galaxy-2.0.db só para os jogos GOG, butler.db do itch.io, SQLite do Amazon Games, product.db do Battle.net e registro da Ubisoft/EA/Rockstar",
  "Promoções da Steam, GOG e Epic, wishlist da Steam com preço atual e login Epic de uso único para a biblioteca comprada",
  "Steam Web API opcional: biblioteca completa da conta e horas jogadas, com a sua chave",
  `Catálogo de ${PLATFORMS.length} plataformas, ${PROVIDERS.length} provedores e ${EMULATORS.length} emuladores (com mapa plataforma → emulador)`,
  "Capas reais (Steam CDN e libretro) com fallback gerado",
  "Notas públicas reais: Steam Reviews (sem chave) e RAWG/Metacritic (com chave), cache de 24h",
  "Instalar/desinstalar jogo abre o fluxo da própria loja (steam://install, com.epicgames.launcher://…)",
  "Instalar/remover emulador roda winget/Scoop/Flatpak/Homebrew de verdade e acompanha a saída real",
  "Jogar em emulador executa o executável encontrado no disco, com argv em array e sem shell",
  "Varredura de pastas de ROMs com revisão antes de importar; backup em JSON validado",
];

const LIMITED = [
  "PSN, Xbox Live, Nintendo, humble e Xbox app: exigem login no serviço; ficam como cadastro manual",
  "Ubisoft: o cache de posse é criptografado; os comprados vêm do login em Conexões (ainda não validado com conta real)",
  "Playnite: banco LiteDB, não lido",
  "Resgate de jogos grátis continua sendo feito por você na loja; o app só mostra a oferta",
  "Identificação de ROM por hash (No-Intro/Redump): ainda usa pasta + extensão",
];

export function SettingsView() {
  const { settings, setSettings, reset, detect, refreshEmulators } = useLibrary();
  const toast = useUi((s) => s.toast);
  const go = useUi((s) => s.go);

  const chooseEmulatorsDir = async () => {
    const dir = await pickDirectory("Onde estão os emuladores instalados");
    if (!dir) return;
    setSettings({ emulatorsDir: dir });
    toast("Pasta de emuladores salva");
    await refreshEmulators();
  };

  return (
    <>
      <header className="page-head"><div><h1>Ajustes</h1></div></header>
      <section className="panel narrow">
        <h3 aria-level={2}>Pastas</h3>
        <label>Pasta de ROMs / ISOs<input value={settings.romsDir} onChange={(e) => setSettings({ romsDir: e.target.value })} placeholder="D:\ROMs" /></label>
        <label>Pasta de emuladores<input value={settings.emulatorsDir} onChange={(e) => setSettings({ emulatorsDir: e.target.value })} placeholder="ex.: D:\Games\Emuladores" /></label>
        <p className="muted small">
          Usada para varrer ROMs e para achar executáveis fora do PATH, do WinGet e de Program Files — necessário
          para instalações portáteis (o app procura até 4 níveis abaixo da pasta).
        </p>
        <div className="actions">
          <button className="btn" onClick={() => void chooseEmulatorsDir()}><FolderOpen size={14} aria-hidden /> Escolher pasta de emuladores</button>
          <button className="btn primary" onClick={() => void detect()}><FolderSearch size={14} aria-hidden /> Detectar bibliotecas agora</button>
          <button className="btn" onClick={() => void refreshEmulators()}><RefreshCw size={14} aria-hidden /> Reconferir emuladores</button>
        </div>
      </section>
      <p className="muted small">Chaves da Steam, RAWG e testes de conexão ficam em <button className="link" onClick={() => go("connections")}>Conexões</button>.</p>
      <UpdatesPanel />
      <BackupSettings />
      <section className="panel narrow">
        <h3 aria-level={2}>Dados reais</h3>
        <h4 aria-level={3}>Lido direto do computador</h4>
        <ul className="plain">{REAL.map((x) => <li key={x}>{x}</li>)}</ul>
        <h4 aria-level={3}>Continua fora do alcance</h4>
        <ul className="plain">{LIMITED.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>
      <section className="panel narrow">
        <h3 aria-level={2}>Biblioteca</h3>
        <p className="muted small">Apagar remove os jogos e o histórico de varreduras deste perfil. Os launchers no disco não são tocados; a detecção repovoa tudo em um clique.</p>
        <button className="btn ghost danger" onClick={() => {
          if (!window.confirm("Apagar a biblioteca deste perfil e começar do zero? Os jogos instalados continuam no disco.")) return;
          reset();
          toast("Biblioteca limpa");
        }}>Limpar biblioteca</button>
      </section>
    </>
  );
}
