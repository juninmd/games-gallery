import { describe, expect, it } from "vitest";
import { newlyPressed, padActions } from "./gamepad";
import { pickNext } from "./spatialNav";

const pressed = (...i: number[]) => Array.from({ length: 17 }, (_, n) => i.includes(n));

describe("gamepad mapping (standard layout)", () => {
  it("maps the D-pad, A, B and Start", () => {
    expect([...padActions({ pressed: pressed(12, 0), axes: [0, 0] })].sort()).toEqual(["confirm", "up"]);
    expect([...padActions({ pressed: pressed(1, 9), axes: [] })].sort()).toEqual(["back", "menu"]);
  });
  it("treats the left stick past half travel as a direction, ignoring small drift", () => {
    expect([...padActions({ pressed: [], axes: [0.9, -0.2] })]).toEqual(["right"]);
    expect(padActions({ pressed: [], axes: [0.3, 0.4] }).size).toBe(0);
  });
  it("fires a held button once", () => {
    const a = padActions({ pressed: pressed(13), axes: [] });
    expect(newlyPressed(new Set(), a)).toEqual(["down"]);
    expect(newlyPressed(a, a)).toEqual([]);
  });
});

describe("spatial navigation", () => {
  // A 3x2 grid of 100x100 cards with 20px gaps; we start on the middle top card.
  const grid = [0, 1, 2].flatMap((col) => [0, 1].map((row) => ({ x: col * 120, y: row * 120, w: 100, h: 100 })));
  const from = { x: 120, y: 0, w: 100, h: 100 };
  const at = (i: number) => grid[i] && `${grid[i]!.x},${grid[i]!.y}`;
  it("moves along the row and down the column", () => {
    expect(at(pickNext(from, grid, "right"))).toBe("240,0");
    expect(at(pickNext(from, grid, "left"))).toBe("0,0");
    expect(at(pickNext(from, grid, "down"))).toBe("120,120");
  });
  it("prefers the aligned target over a closer diagonal one", () => {
    const boxes = [{ x: 150, y: 130, w: 20, h: 20 }, { x: 120, y: 300, w: 100, h: 100 }, { x: 260, y: 110, w: 100, h: 100 }];
    expect(pickNext(from, boxes, "down")).toBe(0);
    expect(pickNext(from, [{ x: 400, y: 150, w: 100, h: 100 }, { x: 120, y: 260, w: 100, h: 100 }], "down")).toBe(1);
  });
  it("returns -1 at an edge", () => {
    expect(pickNext(from, grid, "up")).toBe(-1);
  });
});
