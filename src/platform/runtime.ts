import { LINK_HOSTS, safeUrl } from "../domain/freebies";
import type { LaunchPlan } from "../domain/launch";

export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type LaunchResult = { ok: true; detail: string } | { ok: false; error: string };

/** Store schemes the installed app is allowed to hand to the OS (mirrored in the Tauri capabilities). */
const STORE_SCHEMES = new Set(["steam:", "goggalaxy:", "com.epicgames.launcher:", "uplay:", "battlenet:", "itch:"]);

export function isStoreUri(uri: string): boolean {
  try {
    return STORE_SCHEMES.has(new URL(uri).protocol);
  } catch {
    return false;
  }
}

const asError = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Opens a store deep link (install/uninstall/launch) in the launcher that owns the game. */
export async function openStore(uri: string): Promise<LaunchResult> {
  if (!isStoreUri(uri)) return { ok: false, error: "URI de loja não permitida." };
  if (!isTauri()) return { ok: false, error: "Abrir a loja só funciona no app instalado (pnpm tauri dev ou o app)." };
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(uri);
    return { ok: true, detail: uri };
  } catch (e) {
    return { ok: false, error: asError(e) };
  }
}

/**
 * Runs the plan for real: store URIs go to the launcher, emulated games are spawned by the Rust
 * command with an explicit argv (no shell). In the browser nothing is executed.
 */
export async function launch(plan: LaunchPlan): Promise<LaunchResult> {
  if (plan.kind === "blocked") return { ok: false, error: plan.reason };
  if (plan.kind === "uri") return openStore(plan.uri);
  if (!isTauri()) return { ok: false, error: "Executar emulador só funciona no app instalado." };
  try {
    const { launchEmulator } = await import("./native");
    const pid = await launchEmulator(plan.exe, plan.args);
    return { ok: true, detail: `${plan.preview} (PID ${pid})` };
  } catch (e) {
    return { ok: false, error: asError(e) };
  }
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
