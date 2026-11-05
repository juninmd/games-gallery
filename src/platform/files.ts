import { MAX_BACKUP_BYTES } from "../domain/backup";
import { isTauri } from "./runtime";

const TOO_BIG = "Arquivo grande demais para ser um backup.";
export type FileKind = "json" | "csv";
const KINDS: Record<FileKind, { filters: { name: string; extensions: string[] }[]; accept: string; mime: string }> = {
  json: { filters: [{ name: "Backup JSON", extensions: ["json"] }], accept: ".json,application/json", mime: "application/json" },
  csv: { filters: [{ name: "Planilha CSV", extensions: ["csv"] }], accept: ".csv,text/csv", mime: "text/csv" },
};

/** Returns false when the user cancels. */
export async function saveTextFile(defaultName: string, text: string, kind: FileKind = "json"): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    // The save dialog grants fs write scope to the chosen file only.
    const path = await save({ defaultPath: defaultName, filters: KINDS[kind].filters });
    if (!path) return false;
    await writeTextFile(path, text);
    return true;
  }
  const url = URL.createObjectURL(new Blob([text], { type: KINDS[kind].mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

function pickInBrowser(kind: FileKind): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = KINDS[kind].accept;
    input.hidden = true;
    document.body.appendChild(input);
    const done = (v: string | null) => {
      input.remove();
      resolve(v);
    };
    input.addEventListener("cancel", () => done(null));
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      // Size is checked before reading so a huge file never reaches memory as a string.
      try {
        if (file && file.size > MAX_BACKUP_BYTES) throw new Error(TOO_BIG);
        done(file ? await file.text() : null);
      } catch (e) {
        input.remove();
        reject(e);
      }
    });
    input.click();
  });
}

/** Returns null when the user cancels; rejects when the file is over the backup size limit. */
export async function pickTextFile(kind: FileKind = "json"): Promise<string | null> {
  if (!isTauri()) return pickInBrowser(kind);
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile, stat } = await import("@tauri-apps/plugin-fs");
  const path = await open({ multiple: false, directory: false, filters: KINDS[kind].filters });
  if (typeof path !== "string") return null;
  // Check the size before reading: readTextFile loads the whole file into memory.
  if ((await stat(path)).size > MAX_BACKUP_BYTES) throw new Error(TOO_BIG);
  return readTextFile(path);
}
