import { describe, expect, it } from "vitest";
import type { View } from "../state/ui";
import { viewTitle } from "./nav";

const VIEWS: View[] = ["library", "installed", "board", "platforms", "providers", "freebies", "deals", "connections", "folders", "emulators", "stats", "settings"];

describe("viewTitle", () => {
  it("names every screen, so navigation is never announced as 'undefined'", () => {
    for (const view of VIEWS) {
      expect(viewTitle(view)).toMatch(/^\S.* · Games Gallery$/);
      expect(viewTitle(view)).not.toContain("undefined");
    }
  });

  it("uses the label the dock shows", () => {
    expect(viewTitle("board")).toBe("Quero jogar · Games Gallery");
  });
});
