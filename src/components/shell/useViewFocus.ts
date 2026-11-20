import { useEffect, useRef, type RefObject } from "react";
import type { View } from "../../state/ui";
import { viewTitle } from "../nav";

/**
 * Client-side navigation never moves focus: after a screen change, title the window and
 * focus the new screen's h1 (lazy screens mount later, so wait for it to appear).
 */
export function useViewFocus(view: View, stage: RefObject<HTMLElement | null>) {
  const first = useRef(true);
  useEffect(() => {
    document.title = viewTitle(view);
    if (first.current) { first.current = false; return; }
    const root = stage.current;
    // Focus still inside the stage (e.g. on the Central tabs that survive the switch): keep it there.
    if (!root || root.contains(document.activeElement)) return;
    const focusHeading = () => {
      const h1 = root.querySelector("h1");
      if (!h1) return false;
      h1.tabIndex = -1;
      h1.focus({ preventScroll: true });
      return true;
    };
    if (focusHeading()) return;
    const observer = new MutationObserver(() => { if (focusHeading()) observer.disconnect(); });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [view, stage]);
}
