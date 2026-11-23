import { ImageDown } from "lucide-react";
import { useEffect, useState } from "react";
import { classifyDrop } from "../../domain/drop";
import { planRomImport } from "../../domain/scan/plan";
import { importCoverFile } from "../../platform/covers";
import { isTauri } from "../../platform/runtime";
import { useLibrary } from "../../state/library";
import { useUi } from "../../state/ui";

async function handleDrop(paths: string[]) {
  const { toast, selectedId } = useUi.getState();
  const plan = classifyDrop(paths);
  const notes: string[] = [];

  if (plan.roms.length) {
    const library = useLibrary.getState();
    const items = planRomImport(plan.roms, library.games, (p) => p);
    library.importItems(items, { kind: "roms", name: "Arrastar e soltar" });
    notes.push(`${items.filter((i) => i.kind !== "same").length} ROM(s) importada(s)`);
  }
  if (plan.covers.length) {
    if (!selectedId) notes.push("abra um jogo e solte a imagem para trocar a capa");
    else {
      try {
        useLibrary.getState().patchGame(selectedId, { coverUrl: await importCoverFile(plan.covers[0]!) });
        notes.push("capa atualizada");
      } catch (e) {
        notes.push(e instanceof Error ? e.message : String(e));
      }
    }
  }
  if (plan.ignored) notes.push(`${plan.ignored} arquivo(s) ignorado(s)`);
  if (notes.length) toast(notes.join(" · ").replace(/^./, (c) => c.toUpperCase()));
}

/**
 * Desktop only: files dropped anywhere on the window. The paths come from the native drop event,
 * not from the page's `drop` handler, so the WebView never reads the files itself.
 */
export function DropImport() {
  const [over, setOver] = useState(false);
  const gameOpen = useUi((s) => s.selectedId !== null);

  useEffect(() => {
    if (!isTauri()) return;
    let off: (() => void) | undefined;
    let live = true;
    void import("@tauri-apps/api/webview").then(async ({ getCurrentWebview }) => {
      const unlisten = await getCurrentWebview().onDragDropEvent(({ payload }) => {
        if (payload.type === "enter") setOver(true);
        else if (payload.type === "leave") setOver(false);
        else if (payload.type === "drop") { setOver(false); void handleDrop(payload.paths); }
      });
      if (live) off = unlisten; else unlisten();
    });
    return () => { live = false; off?.(); };
  }, []);

  if (!over) return null;
  return (
    <div className="drop-overlay" role="status">
      <ImageDown size={40} aria-hidden />
      <p className="drop-title">Solte para importar</p>
      <p className="muted">ROMs entram na biblioteca{gameOpen ? "; uma imagem vira a capa deste jogo" : ". Abra um jogo para soltar uma capa"}.</p>
    </div>
  );
}
