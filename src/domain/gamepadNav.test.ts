import { describe, expect, it } from "vitest";
import { NO_GAMEPAD, blockedForGamepad, dirFromAxes, pickNext, type Box } from "./gamepadNav";

const box = (x: number, y: number, w = 100, h = 40): Box => ({ x, y, w, h });

describe("dirFromAxes", () => {
  it("ignores the dead zone and picks the stronger axis", () => {
    expect(dirFromAxes(0.2, -0.3)).toBeNull();
    expect(dirFromAxes(0.9, 0.4)).toBe("right");
    expect(dirFromAxes(-0.6, 0.1)).toBe("left");
    expect(dirFromAxes(0.3, 0.8)).toBe("down");
    expect(dirFromAxes(0.5, -0.9)).toBe("up");
  });
});

describe("blockedForGamepad", () => {
  it("blocks an element that carries the opt-out marker, directly or through an ancestor", () => {
    const seen: string[] = [];
    const marked = { closest: (s: string) => { seen.push(s); return {}; } };
    expect(blockedForGamepad(marked)).toBe(true);
    expect(seen).toEqual([NO_GAMEPAD]);
  });
  it("lets everything else through, and treats no element as not blocked", () => {
    expect(blockedForGamepad({ closest: () => null })).toBe(false);
    expect(blockedForGamepad(null)).toBe(false);
  });
  it("uses an attribute selector that the markup can actually carry", () => {
    expect(NO_GAMEPAD).toBe("[data-no-gamepad]");
  });
});

describe("pickNext", () => {
  // a 3x2 grid of buttons
  const grid = [box(0, 0), box(120, 0), box(240, 0), box(0, 60), box(120, 60), box(240, 60)];
  /** Grid index reached from `i`, or -1. */
  const idx = (i: number, dir: "up" | "down" | "left" | "right") => {
    const rest = grid.filter((_, j) => j !== i);
    const n = pickNext(grid[i]!, rest, dir);
    return n < 0 ? -1 : grid.indexOf(rest[n]!);
  };

  it("moves along rows and columns of a grid", () => {
    expect(idx(0, "right")).toBe(1);
    expect(idx(1, "right")).toBe(2);
    expect(idx(1, "down")).toBe(4);
    expect(idx(4, "up")).toBe(1);
    expect(idx(5, "left")).toBe(4);
  });
  it("stops at the edges instead of wrapping or jumping", () => {
    expect(idx(0, "left")).toBe(-1);
    expect(idx(0, "up")).toBe(-1);
    expect(idx(2, "right")).toBe(-1);
    expect(idx(5, "down")).toBe(-1);
  });
  it("does not treat a far sideways item as ahead", () => {
    expect(pickNext(box(0, 0), [box(800, 50)], "down")).toBe(-1);
    expect(pickNext(box(0, 0), [box(800, 50)], "right")).toBe(0);
  });
  it("prefers the aligned neighbour over a nearer but offset one", () => {
    expect(pickNext(box(0, 100), [box(70, 0), box(0, 0)], "up")).toBe(1);
  });
  it("returns -1 for no candidates", () => {
    expect(pickNext(box(0, 0), [], "down")).toBe(-1);
  });
});
