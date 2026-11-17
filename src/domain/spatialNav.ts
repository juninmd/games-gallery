export type Direction = "up" | "down" | "left" | "right";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/**
 * Index of the box to focus next from `from` when moving in `dir`: only boxes whose center lies
 * ahead count, and sideways drift weighs twice as much as distance, so rows and columns win.
 */
export function pickNext(from: Box, boxes: Box[], dir: Direction): number {
  const o = center(from);
  let best = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  boxes.forEach((b, i) => {
    const c = center(b);
    const dx = c.x - o.x;
    const dy = c.y - o.y;
    const [ahead, side] = dir === "left" ? [-dx, dy] : dir === "right" ? [dx, dy] : dir === "up" ? [-dy, dx] : [dy, dx];
    if (ahead <= 1) return;
    const score = ahead + Math.abs(side) * 2;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}
