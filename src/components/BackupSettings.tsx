import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { exportBackup, parseBackup } from "../domain/backup";
import { csvToGames, gamesToCsv } from "../domain/csv";
import { pickTextFile, saveTextFile } from "../platform/files";
import { useLibrary } from "../state/library";
import { usePlayLog } from "../state/playLog";
import { usePriceAlerts } from "../state/priceAlerts";
import { useSavedViews } from "../state/savedViews";
import { useUi } from "../state/ui";

const today = () => new Date().toISOString().slice(0, 10);

export function BackupSettings() {
  const toast = useUi((s) => s.toast);

  const onExport = async () => {
    const { games, scans, providers, emulators, settings } = useLibrary.getState();
    try {
      const data = { games, scans, providers, emulators, priceTargets: usePriceAlerts.getState().targets, savedViews: useSavedViews.getState().views, playLog: usePlayLog.getState().log, settings };
      if (await saveTextFile(`games-gallery-${today()}.json`, exportBackup(data))) toast(`Backup exportado: ${games.length} jogos`);
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
      if (r.data.priceTargets) usePriceAlerts.setState({ targets: r.data.priceTargets });
      if (r.data.savedViews) useSavedViews.getState().replace(r.data.savedViews);
      if (r.data.playLog) usePlayLog.getState().replace(r.data.playLog);
      toast(`Backup importado: ${r.data.games.length} jogos`);
    } catch (e) {
      toast(`Falha ao importar: ${String(e)}`);
    }
  };

  const onExportCsv = async () => {
    try {
      const { games } = useLibrary.getState();
      if (await saveTextFile(`games-gallery-${today()}.csv`, gamesToCsv(games), "csv")) toast(`Planilha exportada: ${games.length} jogos`);
    } catch (e) {
      toast(`Falha ao exportar: ${String(e)}`);
    }
  };

  const onImportCsv = async () => {
    try {
      const text = await pickTextFile("csv");
      if (text === null) return;
      const r = csvToGames(text, useLibrary.getState().games);
      if ("error" in r) return toast(r.error);
      if (!r.games.length) return toast(`Nada novo para importar (${r.duplicates} já na biblioteca, ${r.skipped} ignoradas).`);
      const extra = `${r.duplicates ? ` ${r.duplicates} já existem e serão pulados.` : ""}${r.skipped ? ` ${r.skipped} linhas inválidas serão ignoradas.` : ""}`;
      if (!window.confirm(`Adicionar ${r.games.length} jogos da planilha à biblioteca?${extra} Lojas desconhecidas entram como Coleção física.`)) return;
      useLibrary.getState().addGames(r.games);
      toast(`Planilha importada: ${r.games.length} jogos`);
    } catch (e) {
      toast(`Falha ao importar: ${String(e)}`);
    }
  };

  return (
    <section className="panel narrow">
      <h3 aria-level={2}>Backup e planilha</h3>
      <p className="muted small">O JSON leva jogos, notas, tags, vínculos de ROM, emuladores, avisos de preço, visões salvas e o registro de horas. Chaves de API e o cache de notas públicas não entram no arquivo.</p>
      <div className="actions">
        <button className="btn" onClick={onExport}><Download size={15} aria-hidden /> Exportar</button>
        <button className="btn" onClick={onImport}><Upload size={15} aria-hidden /> Importar</button>
      </div>
      <p className="muted small">A planilha CSV abre no Excel/Sheets e lê exportações no estilo Playnite (Name, Source, Platform, Playtime, Categories). Importar só acrescenta jogos novos.</p>
      <div className="actions">
        <button className="btn" onClick={onExportCsv}><FileSpreadsheet size={15} aria-hidden /> Exportar CSV</button>
        <button className="btn" onClick={onImportCsv}><Upload size={15} aria-hidden /> Importar CSV</button>
      </div>
    </section>
  );
}
