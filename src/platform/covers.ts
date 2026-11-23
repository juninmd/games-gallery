import { isTauri } from "./runtime";

const memo = new Map<string, Promise<string>>();

/**
 * Installed app: the cover is downloaded once into the app cache and served through the asset
 * protocol, so it works offline. Browser, or any failure: the original URL.
 */
export function cachedCoverSrc(url: string): Promise<string> {
  // Local art (a dropped file) is already in the cache folder.
  if (!isTauri() || !url.startsWith("https://")) return Promise.resolve(url);
  let hit = memo.get(url);
  if (!hit) {
    hit = (async () => {
      const { convertFileSrc, invoke } = await import("@tauri-apps/api/core");
      return convertFileSrc(await invoke<string>("cover_cached", { url }));
    })().catch(() => url); // No retry this session: a failing host is not hammered on every render.
    memo.set(url, hit);
  }
  return hit;
}

/** Copies a dropped image into the cover cache (the native side checks it is a real image) and returns its URL. */
export async function importCoverFile(path: string): Promise<string> {
  const { convertFileSrc, invoke } = await import("@tauri-apps/api/core");
  return convertFileSrc(await invoke<string>("cover_import", { path }));
}
