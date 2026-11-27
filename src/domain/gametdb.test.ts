import { describe, expect, it } from "vitest";
import { fullCoverUrls, ROM_SERIAL, scanRegions } from "./gametdb";

describe("fullCoverUrls", () => {
  it("builds HD then standard scans in the ID's region for GameCube, Wii and 3DS", () => {
    expect(fullCoverUrls("gc", "GALE01").slice(0, 2)).toEqual([
      "https://art.gametdb.com/wii/coverfullHQ/US/GALE01.png",
      "https://art.gametdb.com/wii/coverfull/US/GALE01.png",
    ]);
    expect(fullCoverUrls("3ds", "AREE")[0]).toBe("https://art.gametdb.com/3ds/coverfullHQ/US/AREE.jpg");
    expect(fullCoverUrls("wii", "RMGP01")[0]).toContain("/EN/RMGP01.png");
  });

  // Every candidate is an HTTP request: a wrong-length or foreign ID must not fire any.
  it("returns nothing for other platforms, missing or malformed IDs", () => {
    expect(fullCoverUrls("ps2", "SLUS20312")).toEqual([]);
    expect(fullCoverUrls("gc", undefined)).toEqual([]);
    expect(fullCoverUrls("gc", "AREE")).toEqual([]);
    expect(fullCoverUrls("3ds", "GALE01")).toEqual([]);
    expect(fullCoverUrls("wii", "../x01")).toEqual([]);
  });
});

describe("scanRegions", () => {
  it("maps the Nintendo region letter and falls back to US", () => {
    expect(scanRegions("GALJ01")).toEqual(["JA"]);
    expect(scanRegions("RMGF01")[0]).toBe("FR");
    expect(scanRegions("ABC?")).toEqual(["US", "EN"]);
  });
});

describe("ROM_SERIAL", () => {
  it("accepts 4- and 6-char IDs only", () => {
    expect(ROM_SERIAL.test("GALE01")).toBe(true);
    expect(ROM_SERIAL.test("AREE")).toBe(true);
    expect(ROM_SERIAL.test("GALE0")).toBe(false);
    expect(ROM_SERIAL.test("gale01")).toBe(false);
  });
});
