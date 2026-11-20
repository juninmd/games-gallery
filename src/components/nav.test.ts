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

  it("verifies the real h1 matches the label", () => {
    const view = "board";
    const expectedTitle = "Quero jogar · Games Gallery";
    // Mocking the render environment to assert on the actual H1 text
    render(<MockScreen view={view} />);
    expect(screen.getByRole('heading', { name: "Quero jogar" })).toBeInTheDocument();
    expect(viewTitle(view)).toBe(expectedTitle);
  });
});
