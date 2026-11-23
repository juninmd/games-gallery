import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useState, type PointerEvent } from "react";
import { isTauri } from "../../platform/runtime";

type Edge = "North" | "South" | "East" | "West" | "NorthEast" | "NorthWest" | "SouthEast" | "SouthWest";
const EDGES: Edge[] = ["North", "South", "East", "West", "NorthEast", "NorthWest", "SouthEast", "SouthWest"];

const win = async () => (await import("@tauri-apps/api/window")).getCurrentWindow();

/** Desktop only: the window has no native frame, so this bar moves it and the edges resize it. */
export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let off: (() => void) | undefined;
    let live = true;
    void win().then(async (w) => {
      const sync = () => void w.isMaximized().then((m) => live && setMaximized(m));
      sync();
      const unlisten = await w.onResized(sync);
      if (live) off = unlisten; else unlisten();
    });
    return () => { live = false; off?.(); };
  }, []);

  if (!isTauri()) return null;

  const resize = (edge: Edge) => (e: PointerEvent) => {
    if (e.button !== 0 || maximized) return;
    e.preventDefault();
    void win().then((w) => w.startResizeDragging(edge));
  };

  return (
    <>
      <div className="titlebar" data-tauri-drag-region>
        <span className="titlebar-name" data-tauri-drag-region>Games Gallery</span>
        <div className="titlebar-controls">
          <button type="button" aria-label="Minimizar" onClick={() => void win().then((w) => w.minimize())}><Minus size={14} aria-hidden /></button>
          <button type="button" aria-label={maximized ? "Restaurar" : "Maximizar"} onClick={() => void win().then((w) => w.toggleMaximize())}>
            {maximized ? <Copy size={12} aria-hidden /> : <Square size={12} aria-hidden />}
          </button>
          <button type="button" className="titlebar-close" aria-label="Fechar" onClick={() => void win().then((w) => w.close())}><X size={15} aria-hidden /></button>
        </div>
      </div>
      {!maximized && EDGES.map((edge) => <div key={edge} className={`resize-edge resize-${edge.toLowerCase()}`} onPointerDown={resize(edge)} aria-hidden />)}
    </>
  );
}
