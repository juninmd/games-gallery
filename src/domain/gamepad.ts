import type { Direction } from "./spatialNav";

export type PadAction = Direction | "confirm" | "back" | "menu";

/** What we read from a Gamepad; plain data so the mapping is testable without a browser. */
export interface PadSnapshot {
  pressed: boolean[];
  axes: number[];
}

const STICK = 0.5;
/** W3C "standard" mapping: 0 = A/Cross, 1 = B/Circle, 9 = Start/Options, 12–15 = D-pad. */
const BUTTONS: [number, PadAction][] = [[12, "up"], [13, "down"], [14, "left"], [15, "right"], [0, "confirm"], [1, "back"], [9, "menu"]];

export function padActions(pad: PadSnapshot): Set<PadAction> {
  const out = new Set<PadAction>();
  for (const [i, action] of BUTTONS) if (pad.pressed[i]) out.add(action);
  const [x = 0, y = 0] = pad.axes;
  if (x <= -STICK) out.add("left");
  if (x >= STICK) out.add("right");
  if (y <= -STICK) out.add("up");
  if (y >= STICK) out.add("down");
  return out;
}

/** Actions that went from released to pressed: holding a button fires once. */
export const newlyPressed = (prev: Set<PadAction>, curr: Set<PadAction>): PadAction[] => [...curr].filter((a) => !prev.has(a));
