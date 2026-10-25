import { AMBIGUOUS_EXT, UNIQUE_EXT } from "../domain/scan/platformMap";
import { isEpicItemPath, isLegendaryInstalledPath } from "../domain/scan/epic";
import { isManifestPath } from "../domain/scan/steam";
import { isTauri } from "./runtime";

export type FolderKind = "roms" | "games" | "epic";

export interface FolderListing {
  rootName: string;
  /** Absolute path; only known in Tauri (browsers hide it). */
  rootPath?: string;
  /** Relevant files only (ROM-like or Steam manifests), slash-separated, starting with `rootName`. */
  files: string[];
  truncated: boolean;
  /** Folders that could not be read (permissions); the scan continues without them. */
  unreadable: number;
  readText: (path: string) => Promise<string>;
  /** Size lookup for selected metadata files only; never used on install locations. */
  fileSize?: (path: string) => Promise<number | undefined>;
}

export const MAX_FILES = 50_000;
const MAX_DEPTH = 8;
// Steam library internals that hold game data, not manifests: never worth walking.
const SKIP_DIRS = new Set(["common", "workshop", "downloading", "shadercache", "compatdata", "temp"]);

const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "");
const baseName = (p: string) => norm(p).split("/").pop() ?? p;

/** Keeps listings small: scraped media and saves in a ROM tree must not eat the file budget. */
function relevant(kind: FolderKind, path: string): boolean {
  if (kind === "games") return isManifestPath(path);
  if (kind === "epic") return isEpicItemPath(path) || isLegendaryInstalledPath(path);
  const name = path.slice(path.lastIndexOf("/") + 1);
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  return ext in UNIQUE_EXT || AMBIGUOUS_EXT.has(ext);
}

/** Path stored on a game: absolute in Tauri, root-relative in the browser. */
export const storedPath = (l: FolderListing, rel: string) =>
  l.rootPath ? `${norm(l.rootPath)}/${rel.slice(l.rootName.length + 1)}` : rel;

function pickInBrowser(kind: FolderKind): Promise<FolderListing | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.webkitdirectory = true;
    input.hidden = true;
    // Attached so browsers that only fire `cancel` on connected inputs still resolve.
    document.body.appendChild(input);
    const done = (v: FolderListing | null) => {
      input.remove();
      resolve(v);
    };
    input.addEventListener("cancel", () => done(null));
    input.addEventListener("change", () => {
      const all = Array.from(input.files ?? []);
      if (!all.length) return done(null);
      const byPath = new Map(all.map((f) => [f.webkitRelativePath, f]));
      const files = [...byPath.keys()].filter((p) => relevant(kind, p));
      done({
        rootName: all[0]?.webkitRelativePath.split("/")[0] ?? "",
        files: files.slice(0, MAX_FILES),
        truncated: files.length > MAX_FILES,
        unreadable: 0,
        readText: async (p) => (await byPath.get(p)?.text()) ?? "",
        fileSize: async (p) => byPath.get(p)?.size,
      });
    });
    input.click();
  });
}

async function pickInTauri(kind: FolderKind): Promise<FolderListing | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readDir, readTextFile, stat } = await import("@tauri-apps/plugin-fs");
  // The dialog grants fs scope to the chosen folder only; there is no static fs scope.
  const pickerTitle = kind === "roms" ? "Pasta de ROMs" : kind === "epic" ? "Manifests Epic/Legendary" : "Pasta de jogos";
  const chosen = await open({ directory: true, multiple: false, recursive: true, title: pickerTitle });
  if (typeof chosen !== "string") return null;
  const rootPath = norm(chosen);
  const rootName = baseName(rootPath);
  const files: string[] = [];
  let truncated = false;
  let unreadable = 0;

  const walk = async (abs: string, rel: string, depth: number): Promise<void> => {
    let entries;
    try {
      entries = await readDir(abs);
    } catch {
      unreadable++; // e.g. "System Volume Information": skip it, keep scanning
      return;
    }
    for (const e of entries) {
      if (files.length >= MAX_FILES) { truncated = true; return; }
      if (e.isSymlink) continue;
      if (e.isDirectory) {
        if (depth < MAX_DEPTH && !(kind !== "roms" && SKIP_DIRS.has(e.name.toLowerCase()))) {
          await walk(`${abs}/${e.name}`, `${rel}/${e.name}`, depth + 1);
        }
      } else if (e.isFile && relevant(kind, `${rel}/${e.name}`)) {
        files.push(`${rel}/${e.name}`);
      }
    }
  };
  await walk(rootPath, rootName, 0);
  return {
    rootName, rootPath, files, truncated, unreadable,
    readText: (p) => readTextFile(`${rootPath}/${p.slice(rootName.length + 1)}`),
    fileSize: async (p) => (await stat(`${rootPath}/${p.slice(rootName.length + 1)}`)).size,
  };
}

/** Must be called straight from a click handler: browsers block the picker otherwise. */
export const pickFolder = (kind: FolderKind) => (isTauri() ? pickInTauri(kind) : pickInBrowser(kind));
