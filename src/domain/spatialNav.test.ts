import { describe, expect, it } from "vitest";
import { pickNext, type Box } from "./spatialNav";

const box = (x: number, y: number): Box => ({ x, y, w: 10, h: 10 });

describe("pickNext", () => {
  const from = box(100, 100);

  it("moves to the nearest box ahead in each direction", () => {
    const boxes = [box(200, 100), box(0, 100), box(100, 0), box(100, 200)];
    expect(pickNext(from, boxes, "right")).toBe(0);
    expect(pickNext(from, boxes, "left")).toBe(1);
    expect(pickNext(from, boxes, "up")).toBe(2);
    expect(pickNext(from, boxes, "down")).toBe(3);
  });

  it("prefers the aligned row over a closer box that drifts sideways", () => {
    const boxes = [box(130, 160), box(220, 100)];
    expect(pickNext(from, boxes, "right")).toBe(1);
  });

  it("ignores boxes behind, at the same position or beside the origin", () => {
    expect(pickNext(from, [box(100, 100), box(0, 100), box(100, 0)], "right")).toBe(-1);
  });

  it("returns -1 when there is nothing to focus", () => {
    expect(pickNext(from, [], "down")).toBe(-1);
  });
});
