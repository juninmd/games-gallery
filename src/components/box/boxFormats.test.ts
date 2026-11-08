import { describe, expect, it } from "vitest";
import { PLATFORMS } from "../../domain/platforms";
import { artSeed, boxSpecFor, hashString, knownBoxPlatforms, layoutShelves } from "./boxFormats";
import { brandPath } from "./brandIcons";

describe("boxSpecFor", () => {
  it("has a package for every platform the app knows", () => {
    expect(knownBoxPlatforms().sort()).toEqual(PLATFORMS.map((p) => p.id).sort());
  });

  it("gives every package real, positive dimensions", () => {
    for (const p of PLATFORMS) {
      const spec = boxSpecFor(p.id);
      expect(spec.w).toBeGreaterThan(60);
      expect(spec.h).toBeGreaterThan(80);
      expect(spec.d).toBeGreaterThan(8);
      expect(spec.mediaLabel).not.toBe("");
    }
  });

  it("matches each console to the right media", () => {
    expect(boxSpecFor("snes")).toMatchObject({ format: "carton", media: "cart-snes" });
    expect(boxSpecFor("n64").media).toBe("cart-n64");
    expect(boxSpecFor("ps5")).toMatchObject({ format: "bluray", media: "disc" });
    expect(boxSpecFor("ps1").format).toBe("jewel");
    expect(boxSpecFor("switch").media).toBe("card");
    expect(boxSpecFor("gc").media).toBe("minidisc");
    expect(boxSpecFor("psp").media).toBe("umd");
  });

  it("falls back to a disc case for an unknown platform", () => {
    expect(boxSpecFor("does-not-exist").format).toBe("dvd");
  });
});

describe("layoutShelves", () => {
  it("fills a row until the next box would overflow", () => {
    expect(layoutShelves([100, 100, 100, 100], 330, 14)).toEqual([[0, 1, 2], [3]]);
  });

  it("always places at least one box per row, even when wider than the shelf", () => {
    expect(layoutShelves([500, 100], 300, 14)).toEqual([[0], [1]]);
  });

  it("returns no rows for an empty library", () => {
    expect(layoutShelves([], 500, 14)).toEqual([]);
  });
});

describe("generated art", () => {
  it("is stable for the same title and differs between titles", () => {
    expect(artSeed("Hades", "pc")).toEqual(artSeed("Hades", "pc"));
    expect(hashString("Hades")).not.toBe(hashString("Celeste"));
  });
});

describe("brandPath", () => {
  it("uses the store mark for PC and the console mark otherwise", () => {
    expect(brandPath("pc", "steam")).toBeTruthy();
    expect(brandPath("pc", "steam")).not.toBe(brandPath("pc", "epic"));
    expect(brandPath("ps5")).toBeTruthy();
    expect(brandPath("arcade")).toBeNull();
  });
});
