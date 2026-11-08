import { create } from "zustand";
import { isUpdateAvailable, type ReleaseInfo } from "../domain/release";
import { downloadAndInstall, fetchLatestRelease, relaunchApp, updaterReady } from "../platform/updates";
import { useUi } from "./ui";

const AUTO_KEY = "games-gallery:update-auto";
const CHECKED_KEY = "games-gallery:update-checked";
/** Automatic checks run at most this often; the manual button always checks. */
export const AUTO_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type UpdatePhase = "idle" | "checking" | "current" | "available" | "downloading" | "restarting" | "error";

const readAuto = () => {
  try { return localStorage.getItem(AUTO_KEY) !== "0"; } catch { return true; }
};
const readChecked = (): number | null => {
  try {
    const n = Number(localStorage.getItem(CHECKED_KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
};
const remember = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable: keep in memory */ }
};

interface UpdateState {
  phase: UpdatePhase;
  /** Version this build was compiled as. */
  current: string;
  latest: ReleaseInfo | null;
  /** The build can verify and install the update itself; otherwise the user is sent to the release page. */
  canInstall: boolean;
  /** 0..1 while downloading, null when the size is unknown. */
  progress: number | null;
  error: string | null;
  checkedAt: number | null;
  auto: boolean;
  check: (opts?: { auto?: boolean }) => Promise<void>;
  install: () => Promise<void>;
  setAuto: (auto: boolean) => void;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useUpdates = create<UpdateState>((set, get) => ({
  phase: "idle",
  current: __APP_VERSION__,
  latest: null,
  canInstall: false,
  progress: null,
  error: null,
  checkedAt: readChecked(),
  auto: readAuto(),

  check: async (opts) => {
    const { phase, auto, checkedAt } = get();
    if (phase === "checking" || phase === "downloading" || phase === "restarting") return;
    if (opts?.auto && (!auto || (checkedAt !== null && Date.now() - checkedAt < AUTO_INTERVAL_MS))) return;
    set({ phase: "checking", error: null });
    try {
      const [latest, ready] = await Promise.all([fetchLatestRelease(), updaterReady()]);
      const now = Date.now();
      remember(CHECKED_KEY, String(now));
      if (latest && isUpdateAvailable(get().current, latest.version)) {
        set({ phase: "available", latest, canInstall: ready, checkedAt: now });
        useUi.getState().toast(`Nova versão disponível: v${latest.version}`);
      } else {
        set({ phase: "current", latest, canInstall: false, checkedAt: now });
      }
    } catch (e) {
      set({ phase: "error", error: message(e) });
    }
  },

  install: async () => {
    const { phase, canInstall } = get();
    if (phase !== "available" || !canInstall) return;
    set({ phase: "downloading", progress: 0, error: null });
    try {
      await downloadAndInstall((progress) => set({ progress }));
      set({ phase: "restarting", progress: 1 });
      await relaunchApp();
    } catch (e) {
      set({ phase: "available", error: message(e), progress: null });
    }
  },

  setAuto: (auto) => {
    remember(AUTO_KEY, auto ? "1" : "0");
    set({ auto });
  },
}));
