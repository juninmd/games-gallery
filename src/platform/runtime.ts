import { LINK_HOSTS, safeUrl } from "../domain/freebies";
import type { LaunchPlan } from "../domain/launch";

export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type LaunchResult = { ok: true; simulated: boolean; detail: string } | { ok: false; error: string };

/**
 * Prototype bridge. In the browser everything is simulated. In Tauri only store URIs are
 * opened for real (allow-listed schemes in capabilities); emulator exec stays simulated
 * until a scoped, argv-only Rust command exists (phase 2).
 */
export async function launch(plan: LaunchPlan): Promise<LaunchResult> {
  if (plan.kind === "blocked") return { ok: false, error: plan.reason };
  // Demo seed ids (`demo-*`) are not real store ids: never hand them to the OS.
  if (plan.kind === "uri" && isTauri() && !plan.uri.includes("demo-")) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(plan.uri);
      return { ok: true, simulated: false, detail: plan.uri };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
  return { ok: true, simulated: true, detail: plan.preview };
}

/** Opens an https page on an allow-listed host (store pages, announcements); anything else is refused. */
export async function openExternal(url: string): Promise<boolean> {
  const safe = safeUrl(url, LINK_HOSTS);
  if (!safe) return false;
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(safe);
  } else {
    window.open(safe, "_blank", "noopener,noreferrer");
  }
  return true;
}
