import { describe, expect, it } from "vitest";
import { appendSession, MAX_SESSION_MINUTES, minutesToHours, recentGameIds, sanitizeSessions, sessionMinutes, type PlaySession } from "./sessions";

const at = (gameId: string, start = "2026-11-01T20:00:00.000Z"): PlaySession => ({ gameId, start, kind: "uri" });

describe("session length", () => {
  it("counts whole minutes between start and exit", () => {
    expect(sessionMinutes(0, 90 * 60_000)).toBe(90);
    expect(sessionMinutes(0, 29_000)).toBe(0);
  });
  it("never goes negative when the clock moves backwards, and caps a window left open", () => {
    expect(sessionMinutes(10_000_000, 0)).toBe(0);
    expect(sessionMinutes(0, 48 * 3_600_000)).toBe(MAX_SESSION_MINUTES);
    expect(sessionMinutes(Number.NaN, 0)).toBe(0);
  });
  it("converts to hours with one decimal, like the playtime field", () => {
    expect(minutesToHours(45)).toBe(0.8);
    expect(minutesToHours(0)).toBe(0);
  });
});

describe("session list", () => {
  it("keeps newest first and stays bounded", () => {
    const list = appendSession(appendSession([], at("a")), at("b"), 2);
    expect(list.map((s) => s.gameId)).toEqual(["b", "a"]);
    expect(appendSession(list, at("c"), 2).map((s) => s.gameId)).toEqual(["c", "b"]);
  });
  it("lists each recently played game once, most recent first", () => {
    expect(recentGameIds([at("b"), at("a"), at("b"), at("c")], 2)).toEqual(["b", "a"]);
    expect(recentGameIds([], 5)).toEqual([]);
  });
});

describe("sanitizing stored sessions", () => {
  it("drops non-arrays, bad dates, unknown kinds and out-of-range minutes", () => {
    expect(sanitizeSessions({})).toEqual([]);
    const good = { ...at("ok"), kind: "exec" as const, minutes: 30 };
    const out = sanitizeSessions([good, null, { ...at("x"), start: "2026-13-45T00:00" }, { ...at("y"), kind: "cmd" }, { ...good, gameId: "" }, { ...good, minutes: -1 }]);
    expect(out[0]).toEqual(good);
    // Invalid minutes are dropped, not the whole session: the start time is still useful.
    expect(out).toEqual([good, { gameId: "ok", start: good.start, kind: "exec" }]);
  });
});
