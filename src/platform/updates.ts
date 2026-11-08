import { isReleasePageUrl, LATEST_RELEASE_API, parseLatestRelease, RELEASES_URL, type ReleaseInfo } from "../domain/release";
import { httpGetJson } from "./http";
import { isTauri } from "./runtime";

/** Newest published release on GitHub, or null when the repository has none yet. */
export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  // The desktop HTTP client sends no User-Agent of its own and GitHub's API rejects such requests.
  const headers = isTauri() ? { "User-Agent": `games-gallery/${__APP_VERSION__}` } : undefined;
  try {
    return parseLatestRelease(await httpGetJson(LATEST_RELEASE_API, headers));
  } catch (e) {
    if (e instanceof Error && e.message === "HTTP 404") return null;
    throw e;
  }
}

/** True when this build can verify and install signed updates (public key embedded by the release build). */
export async function updaterReady(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<boolean>("update_signing_ready");
  } catch {
    return false;
  }
}

/** Downloads the signed update, verifies its signature and installs it. `onProgress` gets 0..1 (or null when the size is unknown). */
export async function downloadAndInstall(onProgress: (fraction: number | null) => void): Promise<void> {
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) throw new Error("Nenhuma atualização assinada foi encontrada para este sistema.");
  let total = 0;
  let received = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") total = event.data.contentLength ?? 0;
    else if (event.event === "Progress") {
      received += event.data.chunkLength;
      onProgress(total > 0 ? Math.min(1, received / total) : null);
    } else onProgress(1);
  });
}

export async function relaunchApp(): Promise<void> {
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

/** Opens a release page of this repository in the browser. */
export async function openReleasePage(url: string = RELEASES_URL): Promise<boolean> {
  if (!isReleasePageUrl(url)) return false;
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return true;
}
