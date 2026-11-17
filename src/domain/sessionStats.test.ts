import { describe, expect, it } from "vitest";
import type { PlaySession } from "./sessions";
import { yearSummary } from "./sessionStats";

// Mid-month, midday UTC: the local month and day are the same in any time zone.
const s = (gameId: string, start: string, minutes?: number): PlaySession => ({ gameId, start, minutes, kind: minutes === undefined ? "uri" : "exec" });

describe("year summary", () => {
  const list = [
    s("a", "2026-03-15T12:00:00.000Z", 90),
    s("a", "2026-03-15T12:30:00.000Z", 30),
    s("b", "2026-07-14T12:00:00.000Z", 200),
    s("c", "2026-07-16T12:00:00.000Z"),
    s("a", "2025-12-14T12:00:00.000Z", 999),
    s("bad", "not a date", 50),
  ];
  it("sums measured minutes per month and only for the chosen year", () => {
    const y = yearSummary(list, 2026);
    expect(y.months[2]).toBe(120);
    expect(y.months[6]).toBe(200);
    expect(y.minutes).toBe(320);
  });
  it("counts store launches as sessions and days, but never as time", () => {
    const y = yearSummary(list, 2026);
    expect(y.sessions).toBe(4);
    expect(y.daysPlayed).toBe(3);
    expect(y.top.map((t) => t.gameId)).toEqual(["b", "a"]);
  });
  it("finds the longest session and handles an empty year", () => {
    expect(yearSummary(list, 2026).longest?.gameId).toBe("b");
    const empty = yearSummary([], 2026);
    expect(empty).toMatchObject({ minutes: 0, sessions: 0, daysPlayed: 0, top: [] });
    expect(empty.longest).toBeUndefined();
  });
});
