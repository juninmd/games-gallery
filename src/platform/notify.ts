import { isTauri } from "./runtime";

/** Native notifications exist only in the installed app; in the browser every call is a quiet "no". */
export async function ensurePermission(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const n = await import("@tauri-apps/plugin-notification");
    if (await n.isPermissionGranted()) return true;
    return (await n.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

export async function notifyNative(title: string, body: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const n = await import("@tauri-apps/plugin-notification");
    if (!(await n.isPermissionGranted())) return false;
    n.sendNotification({ title: title.slice(0, 80), body: body.slice(0, 200) });
    return true;
  } catch {
    return false;
  }
}
