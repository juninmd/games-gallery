import { describe, expect, it } from "vitest";
import { MAX_TAGS, MAX_TAG_LEN, addTag, cleanTag, removeTag, sanitizeTags, tagCounts } from "./tags";
import type { Game } from "./types";

const game = (id: string, tags?: string[]): Game => ({
  id, title: id, platformId: "pc", providerId: "steam", year: 2020, genres: [], status: "backlog", owned: true, installed: false, playtimeH: 0, tags,
});

describe("cleanTag", () => {
  it("collapses whitespace, strips control characters and bounds the length", () => {
    expect(cleanTag("  co\u0000-op \n  local  ")).toBe("co -op local");
    expect(cleanTag("x".repeat(MAX_TAG_LEN + 20))).toHaveLength(MAX_TAG_LEN);
    expect(cleanTag("​​")).toBe("");
  });
});

describe("sanitizeTags", () => {
  it("drops non-strings and duplicates that differ only by case or accents", () => {
    expect(sanitizeTags(["Cozy", "cozy", "CÓZY", 7, null, "Co-op"])).toEqual(["Cozy", "Co-op"]);
  });
  it("caps the count and returns undefined when nothing is left", () => {
    expect(sanitizeTags(Array.from({ length: 40 }, (_, i) => `t${i}`))).toHaveLength(MAX_TAGS);
    expect(sanitizeTags(["  ", ""])).toBeUndefined();
    expect(sanitizeTags("cozy")).toBeUndefined();
  });
  it("keeps prototype-ish words as plain text", () => {
    expect(sanitizeTags(["__proto__", "constructor"])).toEqual(["__proto__", "constructor"]);
  });
});

describe("addTag / removeTag", () => {
  it("adds once and removes by folded key", () => {
    const t = addTag(addTag(undefined, "Cozy"), "cozy");
    expect(t).toEqual(["Cozy"]);
    expect(removeTag(t, "CÓZY")).toBeUndefined();
  });
  it("refuses to grow past the limit without losing existing tags", () => {
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`);
    expect(addTag(full, "extra")).toEqual(full);
  });
});

describe("tagCounts", () => {
  it("counts titles per tag, most used first", () => {
    const rows = tagCounts([game("a", ["Cozy", "Co-op"]), game("b", ["cozy"]), game("c")]);
    expect(rows.map((r) => [r.label, r.count])).toEqual([["Cozy", 2], ["Co-op", 1]]);
  });
});
