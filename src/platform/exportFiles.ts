import { isTauri } from "./runtime";

export interface OutFile {
  /** Plain file name, never a path: callers build it from catalog data. */
  name: string;
  text: string;
}

const SAFE_NAME = /^[^/\\:*?"<>|\u0000-\u001f]+$/;

/** "a.lpl" -> "a (gallery).lpl": never overwrite a file the user may have tuned (RetroArch keeps cores and CRCs in it). */
export function alternateName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? `${name.slice(0, dot)} (gallery)${name.slice(dot)}` : `${name} (gallery)`;
}

/**
 * Writes several files: into one chosen folder in Tauri, as sequential downloads in the browser.
 * Returns null on cancel, otherwise how many files were saved under an alternate name because the target existed.
 */
export async function saveFiles(files: OutFile[]): Promise<number | null> {
  if (files.some((f) => !SAFE_NAME.test(f.name))) throw new Error("Nome de arquivo inválido.");
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { exists, writeTextFile } = await import("@tauri-apps/plugin-fs");
    // `recursive: true` makes the dialog grant fs scope to the chosen folder only.
    const dir = await open({ directory: true, multiple: false, recursive: true, title: "Pasta de destino" });
    if (typeof dir !== "string") return null;
    const base = dir.replace(/\\/g, "/").replace(/\/+$/, "");
    let renamed = 0;
    for (const f of files) {
      const taken = await exists(`${base}/${f.name}`);
      if (taken) renamed++;
      await writeTextFile(`${base}/${taken ? alternateName(f.name) : f.name}`, f.text);
    }
    return renamed;
  }
  for (const f of files) {
    const url = URL.createObjectURL(new Blob([f.text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    a.click();
    URL.revokeObjectURL(url);
    await new Promise((r) => setTimeout(r, 150));
  }
  return 0;
}
