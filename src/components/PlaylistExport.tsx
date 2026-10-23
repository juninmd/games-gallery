import { ListMusic } from "lucide-react";
import { buildPlaylists } from "../domain/playlist";
import { saveFiles } from "../platform/exportFiles";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

export function PlaylistExport() {
  const games = useLibrary((s) => s.games);
  const toast = useUi((s) => s.toast);
  const files = buildPlaylists(games);
  const count = files.reduce((n, f) => n + (JSON.parse(f.text) as { items: unknown[] }).items.length, 0);

  const run = async () => {
    try {
      if (await saveFiles(files)) toast(`${files.length} playlist(s) exportada(s): ${count} jogos`);
    } catch (e) {
      toast(`Falha ao exportar: ${String(e)}`);
    }
  };

  return (
    <div className="inline">
      <button className="btn" disabled={!files.length} onClick={run}>
        <ListMusic size={14} aria-hidden /> Exportar playlists (.lpl)
      </button>
      <span className="muted small">{files.length ? `${count} jogos em ${files.length} plataformas` : "Nenhuma ROM com caminho definido"}</span>
    </div>
  );
}
