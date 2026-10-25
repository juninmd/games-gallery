import { FolderSearch } from "lucide-react";
import { useState } from "react";
import { ScanResults } from "../components/ScanResults";
import { scanRoms } from "../domain/scan/classify";
import { scanEpicMetadata } from "../domain/scan/epic";
import { type ImportItem, planEpicImport, planRomImport, planSteamImport } from "../domain/scan/plan";
import { isManifestPath, parseAppManifest } from "../domain/scan/steam";
import type { Game } from "../domain/types";
import { type FolderKind, type FolderListing, pickFolder, storedPath } from "../platform/folders";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";
import "../styles/epic-import.css";

const MAX_MANIFESTS = 500;

interface Pending {
  /** Distinguishes two scans of same-named folders so the review selection resets. */
  id: number;
  kind: FolderKind;
  listing: FolderListing;
  items: ImportItem[];
  notes: string[];
}

async function scanGames(listing: FolderListing, games: Game[]) {
  const paths = listing.files.filter(isManifestPath);
  const read = await Promise.all(paths.slice(0, MAX_MANIFESTS).map((p) => listing.readText(p).then(parseAppManifest, () => null)));
  const notes: string[] = [];
  if (!paths.length) notes.push("Nenhum appmanifest_*.acf encontrado. Escolha a pasta da biblioteca Steam (a que contém “steamapps”).");
  if (paths.length > MAX_MANIFESTS) notes.push(`Só os primeiros ${MAX_MANIFESTS} manifests foram lidos.`);
  return { items: planSteamImport(read.filter((m) => m !== null), games), notes };
}

async function scanEpic(listing: FolderListing, games: Game[]) {
  const scan = await scanEpicMetadata(listing);
  return { items: planEpicImport(scan.entries, games), notes: scan.notes };
}

function scanRomFiles(listing: FolderListing, games: Game[]) {
  const { roms, skipped } = scanRoms(listing.files);
  const ambiguous = skipped.filter((s) => s.reason === "ambiguous").length;
  const notes: string[] = [];
  if (ambiguous) notes.push(`${ambiguous} arquivo(s) .iso/.bin/.chd/.zip ignorados: ponha cada plataforma numa subpasta com nome conhecido (ps2, psx, snes, gc…).`);
  return { items: planRomImport(roms, games, (rel) => storedPath(listing, rel)), notes };
}

export function FoldersView() {
  const scans = useLibrary((s) => s.scans);
  const importItems = useLibrary((s) => s.importItems);
  const toast = useUi((s) => s.toast);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const scan = async (kind: FolderKind) => {
    // pickFolder starts synchronously from the click: browsers block the picker otherwise.
    const picking = pickFolder(kind);
    setBusy(true);
    try {
      const listing = await picking;
      if (!listing) return;
      // Read after the dialog/walk: the library may have changed while they were open.
      const games = useLibrary.getState().games;
      const r = kind === "roms" ? scanRomFiles(listing, games) : kind === "epic" ? await scanEpic(listing, games) : await scanGames(listing, games);
      if (listing.unreadable) r.notes.push(`${listing.unreadable} pasta(s) sem permissão de leitura foram puladas.`);
      if (listing.truncated) r.notes.push("Pasta muito grande: a leitura parou no limite de arquivos.");
      setPending({ id: Date.now(), kind, listing, ...r });
    } catch {
      toast("Não foi possível ler a pasta selecionada.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = (selected: ImportItem[]) => {
    if (!pending) return;
    const { kind, listing } = pending;
    importItems(selected, { kind: kind === "roms" ? "roms" : "games", name: kind === "epic" ? `Epic/Legendary · ${listing.rootName}` : listing.rootName, path: listing.rootPath });
    toast(`Importação concluída: ${selected.filter((i) => i.kind !== "same").length} itens`);
    setPending(null);
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Pastas</h1>
          <p className="muted">Escolha uma pasta, revise o que foi reconhecido e importe. Nada é copiado, movido ou enviado: o app só lê nomes de arquivos e manifests locais.</p>
        </div>
      </header>
      <div className="cards wide">
        <article className="vcard">
          <h3>Pasta de ROMs / ISOs</h3>
          <p className="small muted">Uma subpasta por plataforma (<code>ps2</code>, <code>snes</code>, <code>gc</code>…, os mesmos nomes do ES-DE e do RetroArch). Extensões únicas (.gba, .sfc, .nsp…) dispensam a subpasta. Cada jogo recebe o emulador padrão da plataforma.</p>
          <button className="btn primary" disabled={busy} onClick={() => scan("roms")}><FolderSearch size={15} aria-hidden /> Escolher pasta e varrer</button>
        </article>
        <article className="vcard">
          <h3>Pasta de jogos de PC</h3>
          <p className="small muted">Escolha a biblioteca Steam (a pasta que contém <code>steamapps</code>). Lê os <code>appmanifest_*.acf</code> e marca os jogos como instalados, com o tamanho em disco.</p>
          <button className="btn primary" disabled={busy} onClick={() => scan("games")}><FolderSearch size={15} aria-hidden /> Escolher pasta e varrer</button>
        </article>
        <article className="vcard epic-import-card">
          <h3>Manifestos Epic / Legendary</h3>
          <p className="small muted">Escolha a pasta que contém os arquivos <code>.item</code> do Epic Games Launcher (geralmente em <code>ProgramData/Epic/EpicGamesLauncher/Data/Manifests</code>) ou a pasta de configuração do Legendary/Heroic que contém <code>installed.json</code>. O registro local declara a instalação; os arquivos do jogo não são verificados.</p>
          <button className="btn primary" disabled={busy} onClick={() => scan("epic")}><FolderSearch size={15} aria-hidden /> Escolher pasta e varrer</button>
        </article>
      </div>
      {pending && (
        <ScanResults
          key={pending.id}
          title={`${pending.kind === "roms" ? "ROMs" : pending.kind === "epic" ? "Epic/Legendary" : "Jogos"} em “${pending.listing.rootName}”`}
          items={pending.items}
          notes={pending.notes}
          onImport={confirm}
          onCancel={() => setPending(null)}
        />
      )}
      {!!scans.length && (
        <section className="group gap">
          <h2>Últimas varreduras</h2>
          <ul className="gaps">
            {scans.map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong>{" "}
                <span className="muted small">{s.kind === "roms" ? "ROMs" : "PC"} · {new Date(s.at).toLocaleString("pt-BR")} · {s.added} novos, {s.linked} vinculados{s.path ? ` · ${s.path}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
