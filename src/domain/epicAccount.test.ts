import { describe, expect, it } from "vitest";
import { epicEntries, extractAuthCode, parseCatalogTitles, parseEpicToken, parseLibraryPage } from "./epicAccount";

const CODE = "0123456789abcdef0123456789abcdef";
const rec = (over: Record<string, unknown> = {}) => ({ namespace: "ns1", catalogItemId: "cat1", appName: "Fortnite", sandboxType: "PUBLIC", recordType: "APPLICATION", ...over });

describe("extractAuthCode", () => {
  it("accepts the raw code, quoted code, or the redirect JSON", () => {
    expect(extractAuthCode(CODE)).toBe(CODE);
    expect(extractAuthCode(`  "${CODE}" `)).toBe(CODE);
    expect(extractAuthCode(JSON.stringify({ redirectUrl: "x", authorizationCode: CODE, sid: null }))).toBe(CODE);
  });
  it("rejects anything that is not a 32-hex code (no tokens, no urls, no junk)", () => {
    for (const bad of ["", "   ", "abc", `${CODE}0`, "{not json", JSON.stringify({ authorizationCode: "short" }), "https://x/?code=" + CODE, "z".repeat(32)]) {
      expect(extractAuthCode(bad)).toBeNull();
    }
  });
});

describe("parseEpicToken", () => {
  it("needs both fields", () => {
    expect(parseEpicToken({ access_token: "t", account_id: "a", refresh_token: "r" })).toEqual({ accessToken: "t", accountId: "a" });
    for (const bad of [null, {}, { access_token: "t" }, { account_id: "a" }, "x"]) expect(parseEpicToken(bad)).toBeNull();
  });
});

describe("parseLibraryPage", () => {
  it("keeps public applications and returns the cursor", () => {
    const out = parseLibraryPage({ records: [rec(), rec({ appName: "Private", sandboxType: "PRIVATE" }), rec({ appName: "Dlc", recordType: "DLC" }), rec({ appName: "../x" }), null], responseMetadata: { nextCursor: "abc" } });
    expect(out.records.map((r) => r.appName)).toEqual(["Fortnite"]);
    expect(out.nextCursor).toBe("abc");
  });
  it("never throws on junk", () => {
    for (const bad of [null, [], "x", {}, { records: "no" }]) expect(parseLibraryPage(bad).records).toEqual([]);
  });
});

describe("parseCatalogTitles + epicEntries", () => {
  const catalog = {
    cat1: { title: "Fortnite", categories: [{ path: "games" }] },
    dlc1: { title: "Skin Pack", categories: [{ path: "addons" }] },
    dlc2: { title: "Expansion", mainGameItem: { id: "cat1" }, categories: [] },
    eng: { title: "Unreal Engine", categories: [{ path: "applications/ue" }] },
    "bad id!": { title: "Nope" },
  };
  it("drops add-ons, engine and malformed ids", () => {
    expect([...parseCatalogTitles(catalog).keys()]).toEqual(["cat1"]);
  });
  it("only emits entries whose title resolved, deduped by appName", () => {
    const records = [
      { namespace: "ns1", catalogItemId: "cat1", appName: "Fortnite" },
      { namespace: "ns1", catalogItemId: "cat1", appName: "Fortnite" },
      { namespace: "ns1", catalogItemId: "unknown", appName: "Ghost" },
    ];
    expect(epicEntries(records, parseCatalogTitles(catalog))).toEqual([{ storeId: "Fortnite", title: "Fortnite", installed: false }]);
  });
});

describe("path-safe ids", () => {
  it("rejects dot segments that could climb out of the catalog path", () => {
    for (const bad of [".", ".."]) {
      expect(parseLibraryPage({ records: [rec({ namespace: bad })] }).records).toEqual([]);
      expect(parseLibraryPage({ records: [rec({ catalogItemId: bad })] }).records).toEqual([]);
    }
  });
});
