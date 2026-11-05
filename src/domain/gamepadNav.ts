export type Dir = "up" | "down" | "left" | "right";

/** Controls a controller must never reach: they destroy or replace data, so they stay mouse/keyboard only. */
export const NO_GAMEPAD = "[data-no-gamepad]";

/** True when the element, or an ancestor, opted out of controller control. */
export const blockedForGamepad = (el: { closest: (selector: string) => unknown } | null): boolean => el !== null && el.closest(NO_GAMEPAD) !== null;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Direction for an analog stick, or null inside the dead zone. The stronger axis wins, so a diagonal never double-moves. */
export function dirFromAxes(x: number, y: number, dead = 0.55): Dir | null {
  if (Math.max(Math.abs(x), Math.abs(y)) < dead) return null;
  return Math.abs(x) > Math.abs(y) ? (x > 0 ? "right" : "left") : y > 0 ? "down" : "up";
}

/**
 * Index of the box to focus next when moving `dir` from `cur`, or -1. Candidates must lie in that direction;
 * the nearest along the axis wins, with sideways drift weighed double so the cursor follows rows and columns.
 */
export function pickNext(cur: Box, others: Box[], dir: Dir): number {
  const c = center(cur);
  let best = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  others.forEach((o, i) => {
    const p = center(o);
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const along = dir === "right" ? dx : dir === "left" ? -dx : dir === "down" ? dy : -dy;
    const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    // Strictly ahead, and not more sideways than ahead (a 45° cone): a far-off item in another column is not "down".
    if (along <= 1 || across > along * 1.5 + cur.h) return;
    const score = along + across * 2;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}
