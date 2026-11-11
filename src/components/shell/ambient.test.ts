import { describe, expect, it } from "vitest";
import { ambientFor, titleHue } from "./ambient";

describe("ambient colors", () => {
  it("gives a title the same hue every time", () => {
    expect(titleHue("Factorio")).toBe(titleHue("Factorio"));
    expect(titleHue("Factorio")).toBeGreaterThanOrEqual(0);
    expect(titleHue("Factorio")).toBeLessThan(360);
  });

  it("pairs the platform color with the title hue", () => {
    const [platform, hue] = ambientFor({ title: "Okami", platformId: "ps2" });
    expect(platform).toBe("#3a5bd9");
    expect(hue).toBe(`hsl(${titleHue("Okami")} 80% 58%)`);
  });

  it("falls back to the signature rose for an unknown platform", () => {
    expect(ambientFor({ title: "X", platformId: "nope" })[0]).toBe("#ff4d8d");
  });
});
