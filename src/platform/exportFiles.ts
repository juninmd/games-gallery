import { isTauri } from "./runtime";

export interface OutFile {
  /** Plain file name, never a path: callers build it from catalog data. */
  name: string;
  text: string;
}

const SAFE_NAME = /^[^/\\:*?"<>|\u0000-\u001f]+$/;

/** Writes several files: into one chosen folder in Tauri, as sequential downloads in the browser. Returns false on cancel. */
export async function saveFiles(files: OutFile[]): Promise<boolean> {
  if (files.some((f) => !SAFE_NAME.test(f.name))) throw new Error("Nome de arquivo inválido.");
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    // `recursive: true` makes the dialog grant fs scope to the chosen folder only.
    const dir = await open({ directory: true, multiple: false, recursive: true, title: "Pasta de destino" });
    if (typeof dir !== "string") return false;
    const base = dir.replace(/\\/g, "/").replace(/\/+$/, "");
    for (const f of files) await writeTextFile(`${base}/${f.name}`, f.text);
    return true;
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
  return true;
}
