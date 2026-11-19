import { describe, expect, it } from "vitest";
import { extractNpsso } from "./psnAccount";

const TOKEN = "Ab3".repeat(21) + "x";

describe("extractNpsso", () => {
  it("accepts the raw value or the JSON the Sony page shows", () => {
    expect(extractNpsso(TOKEN)).toBe(TOKEN);
    expect(extractNpsso(`  "${TOKEN}" `)).toBe(TOKEN);
    expect(extractNpsso(`{"npsso":"${TOKEN}"}`)).toBe(TOKEN);
  });

  it("refuses anything that could smuggle extra cookie or header data", () => {
    expect(extractNpsso("")).toBeNull();
    expect(extractNpsso(TOKEN.slice(1))).toBeNull();
    expect(extractNpsso(`${TOKEN.slice(4)}; a=b`)).toBeNull();
    expect(extractNpsso(`{"npsso": 5}`)).toBeNull();
    expect(extractNpsso("{broken")).toBeNull();
  });
});
