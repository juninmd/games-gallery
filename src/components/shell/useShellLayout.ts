import { useSyncExternalStore } from "react";
import { layoutFor, SIDEBAR_MIN_WIDTH, type ShellLayout } from "../../domain/layout";

const QUERY = `(min-width: ${SIDEBAR_MIN_WIDTH}px)`;
const media = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(QUERY) : null);

const subscribe = (onChange: () => void) => {
  const mq = media();
  mq?.addEventListener("change", onChange);
  return () => mq?.removeEventListener("change", onChange);
};
const snapshot = (): ShellLayout => layoutFor(typeof window === "undefined" ? SIDEBAR_MIN_WIDTH : window.innerWidth);

/** Side rail from 768px of window width, bottom tabs below; re-renders only when it crosses the line. */
export const useShellLayout = () => useSyncExternalStore(subscribe, snapshot, () => "sidebar" as const);
