import { useSyncExternalStore } from "react";
import { useUi } from "../state/ui";

const QUERY = "(max-width: 860px)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Icon-only rail: forced on narrow windows, otherwise the user's saved choice. */
export function useCompactSidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const narrow = useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
  return { compact: collapsed || narrow, narrow };
}
