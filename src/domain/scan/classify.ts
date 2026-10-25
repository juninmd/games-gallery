import { fold } from "./fold";
import { AMBIGUOUS_EXT, FOLDER_ALIAS, UNIQUE_EXT, foldFolder } from "./platformMap";

export interface FoundRom {
  /** Path relative to the scanned root, starting with the root folder name. */
  path: string;
  platformId: string;
  title: string;
  /** File name without extension: libretro thumbnails are named after No-Intro dumps. */
  baseName: string;
}

export type Skip = { path: string; reason: "ambiguous" | "companion" };

const DOC_NAMES = /^(readme|license|licence|changelog|notes?|todo|credits|authors|contributing)$/i;

const split = (path: string) => path.split("/").filter(Boolean);
const extOf = (name: string) => (name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "");

/** "Final Fantasy VII (USA) (Disc 1) [!]" -> "Final Fantasy VII". */
export function cleanTitle(baseName: string): string {
  return baseName
    .replace(/\s*[([][^)\]]*[)\]]/g, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const platformFromFolders = (dirs: string[]): string | undefined => {
  // Closest folder wins: ".../psx/Final Fantasy VII/disc.bin" still resolves to psx.
  for (let i = dirs.length - 1; i >= 0; i--) {
    const hit = FOLDER_ALIAS[foldFolder(dirs[i] ?? "")];
    if (hit) return hit;
  }
  return undefined;
};

export type Classified = { rom: FoundRom } | { skip: Skip["reason"] } | null;

/** `siblings` = other file names in the same folder, used to drop .bin tracks of a .cue sheet. */
export function classifyRom(path: string, siblings: string[] = []): Classified {
  return classifyRomKnownCuePresence(path, siblings);
}

function classifyRomKnownCuePresence(path: string, siblings: string[], cueOrGdiPresent?: boolean): Classified {
  const parts = split(path);
  const file = parts[parts.length - 1] ?? "";
  const ext = extOf(file);
  if (!ext) return null;
  const baseName = file.slice(0, file.length - ext.length - 1);
  const unique = UNIQUE_EXT[ext];
  if (!unique && !AMBIGUOUS_EXT.has(ext)) return null;

  if (ext === "bin" && (cueOrGdiPresent ?? siblings.some((s) => extOf(s) === "cue" || extOf(s) === "gdi"))) return { skip: "companion" };

  // .md is a Mega Drive ROM extension but far more often documentation.
  if (ext === "md" && DOC_NAMES.test(baseName)) return null;

  const platformId = unique ?? platformFromFolders(parts.slice(0, -1));
  if (!platformId) return { skip: "ambiguous" };
  const title = cleanTitle(baseName);
  return title ? { rom: { path, platformId, title, baseName } } : null;
}

/** Multi-disc dumps collapse into one entry: "(Disc 2)" and friends are stripped by cleanTitle. */
export function scanRoms(files: string[]): { roms: FoundRom[]; skipped: Skip[] } {
  const byDir = new Map<string, string[]>();
  const dirsWithCueOrGdi = new Set<string>();
  for (const f of files) {
    const i = f.lastIndexOf("/");
    const dir = f.slice(0, i);
    const filename = f.slice(i + 1);
    const siblings = byDir.get(dir);
    if (siblings) siblings.push(filename);
    else byDir.set(dir, [filename]);
    const ext = extOf(filename);
    if (ext === "cue" || ext === "gdi") dirsWithCueOrGdi.add(dir);
  }
  const seen = new Set<string>();
  const roms: FoundRom[] = [];
  const skipped: Skip[] = [];
  for (const path of [...files].sort()) {
    const dir = path.slice(0, path.lastIndexOf("/"));
    const siblings = byDir.get(dir) ?? [];
    const r = classifyRomKnownCuePresence(path, siblings, dirsWithCueOrGdi.has(dir));
    if (!r) continue;
    if ("skip" in r) {
      skipped.push({ path, reason: r.skip });
      continue;
    }
    const key = `${r.rom.platformId}:${fold(r.rom.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    roms.push(r.rom);
  }
  return { roms, skipped };
}
