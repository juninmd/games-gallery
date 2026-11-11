import { flushSync } from "react-dom";
import { PLATFORM_BY_ID } from "../../domain/platforms";
import type { Game } from "../../domain/types";
import { useUi } from "../../state/ui";

/** Stable hue per title, so a game always tints the backdrop the same way. */
export function titleHue(title: string): number {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

/** The two backdrop colors for a game: its platform color and a hue from its title. */
export function ambientFor(game: Pick<Game, "title" | "platformId">): [string, string] {
  const platform = PLATFORM_BY_ID[game.platformId]?.color ?? "#ff4d8d";
  return [platform, `hsl(${titleHue(game.title)} 80% 58%)`];
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type TransitionDoc = Document & { startViewTransition?: (update: () => void) => unknown };

/** Runs a UI update inside a View Transition when the browser supports it. */
export function withViewTransition(update: () => void) {
  const doc = document as TransitionDoc;
  if (!doc.startViewTransition || prefersReducedMotion()) return update();
  doc.startViewTransition(() => flushSync(update));
}

/**
 * Opens a game's detail page; the clicked cover flies into the hero (View Transitions),
 * falling back to the dialog's own entrance animation elsewhere.
 */
export function openGame(id: string, source?: HTMLElement | null) {
  const select = useUi.getState().select;
  const doc = document as TransitionDoc;
  if (!doc.startViewTransition || prefersReducedMotion()) return select(id);
  if (source) source.style.viewTransitionName = "game-cover";
  doc.startViewTransition(() => {
    if (source) source.style.viewTransitionName = "";
    flushSync(() => select(id));
  });
}
