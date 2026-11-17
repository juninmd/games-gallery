import { isTauri } from "./runtime";

const memo = new Map<string, Promise<string>>();

/**
 * Installed app: the cover is downloaded once into the app cache and served through the asset
 * protocol, so it works offline. Browser, or any failure: the original URL.
 */
export function cachedCoverSrc(url: string): Promise<string> {
  if (!isTauri()) return Promise.resolve(url);
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
