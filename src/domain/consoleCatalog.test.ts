import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONSOLE_SHEETS } from "./consoleCatalog";
import { PLATFORM_BY_ID } from "./platforms";

const credits = readFileSync("public/platforms/CREDITS.md", "utf8");

describe("console sheets", () => {
  const entries = Object.entries(CONSOLE_SHEETS);

  it("only describe platforms the app knows", () => {
    expect(entries.length).toBeGreaterThan(20);
    for (const [id] of entries) expect(PLATFORM_BY_ID[id], id).toBeDefined();
  });

  // A photo without a credit row would ship a CC BY-SA work without attribution.
  it("ship every photo with its licence credit", () => {
    for (const [id, sheet] of entries) {
      expect(existsSync(`public${sheet.photo}`), sheet.photo).toBe(true);
      expect(credits, id).toContain(`| ${sheet.photo.split("/").pop()} |`);
    }
  });

  it("have a history and at least one spec", () => {
    for (const [id, sheet] of entries) {
      expect(sheet.history.length, id).toBeGreaterThan(40);
      expect(sheet.specs.length, id).toBeGreaterThan(0);
    }
  });
});
