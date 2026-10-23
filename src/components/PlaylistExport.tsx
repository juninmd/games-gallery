import { ListMusic } from "lucide-react";
import { useMemo } from "react";
import { buildPlaylists } from "../domain/playlist";
import { saveFiles } from "../platform/exportFiles";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

export function PlaylistExport() {
  const games = useLibrary((s) => s.games);
  const toast = useUi((s) => s.toast);
  const files = useMemo(() => buildPlaylists(games), [games]);
  const count = files.reduce((n, f) => n + f.count, 0);

  const run = async () => {
    try {
      const renamed = await saveFiles(files);
      if (renamed === null) return;
      toast(`${files.length} playlist(s) exportada(s): ${count} jogos${renamed ? `; ${renamed} já existia(m) e foi(ram) salva(s) como “(gallery)”` : ""}`);
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
