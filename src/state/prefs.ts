import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MAX_REMEMBERED } from "../domain/notifyPlan";
import { ensurePermission } from "../platform/notify";

interface PrefsState {
  /** Opt-in: native notifications for price targets and Epic giveaways while the app is open. */
  notifications: boolean;
  /** Opt-in: a connected controller moves focus and presses buttons. Off by default (see `platform/gamepad`). */
  gamepadNav: boolean;
  setGamepadNav: (on: boolean) => void;
  /** What was already announced, so the same event is not repeated on every check. */
  announcedHits: string[];
  /** undefined = never checked: the first check only records what is already free. */
  seenFreebies: string[] | undefined;
  setNotifications: (on: boolean) => Promise<boolean>;
  remember: (patch: Partial<Pick<PrefsState, "announcedHits" | "seenFreebies">>) => void;
}

const strings = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 400).slice(-MAX_REMEMBERED) : undefined;

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      notifications: false,
      gamepadNav: false,
      setGamepadNav: (on) => set({ gamepadNav: on }),
      announcedHits: [],
      seenFreebies: undefined,
      setNotifications: async (on) => {
        // Turning on asks the OS once; a refusal leaves the switch off instead of lying about it.
        const granted = on ? await ensurePermission() : false;
        set({ notifications: on && granted });
        return on ? granted : true;
      },
      remember: (patch) => set(patch),
    }),
    {
      name: "games-gallery:prefs:v1",
      version: 1,
      partialize: ({ notifications, gamepadNav, announcedHits, seenFreebies }) => ({ notifications, gamepadNav, announcedHits, seenFreebies }),
      merge: (persisted, current) => {
        const p = typeof persisted === "object" && persisted !== null ? (persisted as Record<string, unknown>) : {};
        return { ...current, notifications: p["notifications"] === true, gamepadNav: p["gamepadNav"] === true, announcedHits: strings(p["announcedHits"]) ?? [], seenFreebies: strings(p["seenFreebies"]) };
      },
    },
  ),
);
