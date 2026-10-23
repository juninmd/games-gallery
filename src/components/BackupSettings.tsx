import { Download, Upload } from "lucide-react";
import { exportBackup, parseBackup } from "../domain/backup";
import { pickTextFile, saveTextFile } from "../platform/files";
import { useLibrary } from "../state/library";
import { useUi } from "../state/ui";

export function BackupSettings() {
  const toast = useUi((s) => s.toast);

  const onExport = async () => {
    const { games, scans, providers, emulators, settings } = useLibrary.getState();
    const day = new Date().toISOString().slice(0, 10);
    try {
      if (await saveTextFile(`games-gallery-${day}.json`, exportBackup({ games, scans, providers, emulators, settings }))) {
        toast(`Backup exportado: ${games.length} jogos`);
      }
    } catch (e) {
      toast(`Falha ao exportar: ${String(e)}`);
    }
  };

  const onImport = async () => {
    try {
      const text = await pickTextFile();
      if (text === null) return;
      const r = parseBackup(text);
      if (!r.ok) return toast(r.error);
      const note = r.dropped ? ` (${r.dropped} entradas inválidas serão ignoradas)` : "";
      if (!window.confirm(`Substituir a biblioteca atual por ${r.data.games.length} jogos do backup?${note}`)) return;
      useLibrary.getState().restore(r.data);
      toast(`Backup importado: ${r.data.games.length} jogos`);
    } catch (e) {
      toast(`Falha ao importar: ${String(e)}`);
    }
  };

  return (
    <section className="panel narrow">
      <h3>Backup</h3>
      <p className="muted small">Exporta jogos, notas, status, vínculos de ROM e emuladores em um JSON. Chaves de API e o cache de notas públicas não entram no arquivo.</p>
      <div className="actions">
        <button className="btn" onClick={onExport}><Download size={15} aria-hidden /> Exportar</button>
        <button className="btn" onClick={onImport}><Upload size={15} aria-hidden /> Importar</button>
      </div>
    </section>
  );
}
