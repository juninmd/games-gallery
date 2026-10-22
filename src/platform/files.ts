import { MAX_BACKUP_BYTES } from "../domain/backup";
import { isTauri } from "./runtime";

const FILTERS = [{ name: "Backup JSON", extensions: ["json"] }];

/** Returns false when the user cancels. */
export async function saveTextFile(defaultName: string, text: string): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    // The save dialog grants fs write scope to the chosen file only.
    const path = await save({ defaultPath: defaultName, filters: FILTERS });
    if (!path) return false;
    await writeTextFile(path, text);
    return true;
  }
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

function pickInBrowser(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
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
      if (file && file.size > MAX_BACKUP_BYTES) {
        input.remove();
        return reject(new Error("Arquivo grande demais para ser um backup."));
      }
      done(file ? await file.text() : null);
    });
    input.click();
  });
}

/** Returns null when the user cancels; rejects when the file is over the backup size limit. */
export async function pickTextFile(): Promise<string | null> {
  if (!isTauri()) return pickInBrowser();
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const path = await open({ multiple: false, directory: false, filters: FILTERS });
  return typeof path === "string" ? readTextFile(path) : null;
}
