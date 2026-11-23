import { classifyRom, type FoundRom } from "./scan/classify";

/** Cover art the app accepts from a dropped file; the native side re-checks the bytes. */
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp"]);
export const MAX_DROPPED = 200;

export interface DropPlan {
  covers: string[];
  /** `path` is the original absolute path, so it can be launched later. */
  roms: FoundRom[];
  ignored: number;
}

const extOf = (path: string) => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
};

/** Splits dropped paths into cover images and ROMs; folders, unknown and ambiguous files are counted as ignored. */
export function classifyDrop(paths: string[]): DropPlan {
  const plan: DropPlan = { covers: [], roms: [], ignored: 0 };
  const list = paths.slice(0, MAX_DROPPED);
  plan.ignored += paths.length - list.length;
  for (const raw of list) {
    const path = raw.replaceAll("\\", "/");
    if (IMAGE_EXT.has(extOf(path))) { plan.covers.push(raw); continue; }
    const r = classifyRom(path);
    if (r && "rom" in r) plan.roms.push({ ...r.rom, path: raw });
    else plan.ignored += 1;
  }
  return plan;
}
