import type { WrappedText } from "../domain/wrappedText";
import { isTauri } from "./runtime";

const W = 1080;
const H = 1350;
const MAX_WIDTH = W - 180; // 90 px margins
const MIN_SCALE = 0.55;

/** Draws the summary card. Text only (no remote images), so nothing external is fetched or leaked into the file. */
export function renderWrapped(t: WrappedText, year: number): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#14102b");
  bg.addColorStop(1, "#3a1245");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const font = (px: number, weight = 500) => { ctx.font = `${weight} ${px}px system-ui, "Segoe UI", sans-serif`; };
  let y = 150;
  // Shrinks a long line to fit the card; only if it still does not fit at the smallest size is it cut with an ellipsis.
  const fit = (text: string, px: number, weight: number): string => {
    let size = px;
    font(size, weight);
    while (ctx.measureText(text).width > MAX_WIDTH && size > px * MIN_SCALE) { size -= 2; font(size, weight); }
    let out = text;
    while (out.length > 1 && ctx.measureText(out).width > MAX_WIDTH) out = `${out.slice(0, -2)}…`;
    return out;
  };
  const line = (text: string, px: number, color: string, weight = 500, gap = 1.45) => {
    const shown = fit(text, px, weight);
    ctx.fillStyle = color;
    ctx.fillText(shown, 90, y);
    y += px * gap;
  };

  line(`Meu ${year} em jogos`, 40, "#f5a3ff", 700);
  y += 20;
  line(t.headline, 76, "#ffffff", 800, 1.3);
  y += 20;
  for (const h of t.highlights) line(h, 34, "#e7e4f5");
  if (t.top.length) {
    y += 40;
    line("Mais jogados", 34, "#f5a3ff", 700);
    for (const r of t.top) line(r, 38, "#ffffff", 600);
  }
  y += 40;
  for (const l of t.library) line(l, 32, "#b9b4d6");
  font(26);
  ctx.fillStyle = "#8e88b3";
  ctx.fillText("Games Gallery", 90, H - 80);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/** Saves a PNG: through the save dialog in the app (write access is limited to the file picked), as a download in the browser. */
export async function savePng(name: string, blob: Blob): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: name, filters: [{ name: "Imagem PNG", extensions: ["png"] }] });
    if (!path) return false;
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return true;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
