import { describe, expect, it } from "vitest";
import { type EpicHttp, EPIC_LOGIN_URL, importEpicAccount } from "./epicAccount";

function fake(overrides: Partial<EpicHttp> = {}) {
  const calls = { post: 0, get: [] as string[], killed: [] as string[] };
  const http: EpicHttp = {
    postForm: async () => { calls.post++; return { access_token: "tok", account_id: "acc" }; },
    getJson: async (url) => {
      calls.get.push(url);
      if (url.includes("/library/")) {
        return url.includes("cursor=c2")
          ? { records: [{ namespace: "n2", catalogItemId: "i2", appName: "Beta", sandboxType: "PUBLIC", recordType: "APPLICATION" }] }
          : { records: [{ namespace: "n1", catalogItemId: "i1", appName: "Alpha", sandboxType: "PUBLIC", recordType: "APPLICATION" }], responseMetadata: { nextCursor: "c2" } };
      }
      if (url.includes("/namespace/n1/")) return { i1: { title: "Alpha Game", categories: [] } };
      if (url.includes("/namespace/n2/")) return { i2: { title: "Beta Game", categories: [] } };
      return {};
    },
    kill: async (t) => { calls.killed.push(t); },
    ...overrides,
  };
  return { http, calls };
}

describe("importEpicAccount", () => {
  it("pages the library, resolves titles per namespace and revokes the token", async () => {
    const { http, calls } = fake();
    const out = await importEpicAccount("c".repeat(32), undefined, http);
    expect(out.map((e) => e.title)).toEqual(["Alpha Game", "Beta Game"]);
    expect(calls.killed).toEqual(["tok"]);
    expect(calls.get.filter((u) => u.includes("/library/"))).toHaveLength(2);
  });
  it("revokes the token even when the library call fails", async () => {
    const { http, calls } = fake({ getJson: async () => { throw new Error("HTTP 500"); } });
    await expect(importEpicAccount("c".repeat(32), undefined, http)).rejects.toThrow("HTTP 500");
    expect(calls.killed).toEqual(["tok"]);
  });
  it("one failing catalog namespace leaves the other games intact", async () => {
    const base = fake().http;
    const { http } = fake({ getJson: async (u, b) => { if (u.includes("/namespace/n1/")) throw new Error("HTTP 429"); return base.getJson(u, b); } });
    expect((await importEpicAccount("c".repeat(32), undefined, http)).map((e) => e.title)).toEqual(["Beta Game"]);
  });
  it("explains a rejected code without calling the library", async () => {
    const { http, calls } = fake({ postForm: async () => ({ errorCode: "invalid_grant" }) });
    await expect(importEpicAccount("c".repeat(32), undefined, http)).rejects.toThrow(/gere outro/);
    expect(calls.get).toHaveLength(0);
    expect(calls.killed).toHaveLength(0);
  });
  it("stops on a repeated cursor instead of looping", async () => {
    const { http, calls } = fake({ getJson: async (u) => (u.includes("/library/") ? { records: [], responseMetadata: { nextCursor: "same" } } : {}) });
    await importEpicAccount("c".repeat(32), undefined, http);
    expect(calls.killed).toEqual(["tok"]);
  });
});

describe("failure visibility", () => {
  it("fails loudly when the library has games but no title could be resolved", async () => {
    const base = fake().http;
    const { http, calls } = fake({ getJson: async (u, b) => { if (u.includes("/namespace/")) throw new Error("HTTP 403"); return base.getJson(u, b); } });
    await expect(importEpicAccount("c".repeat(32), undefined, http)).rejects.toThrow(/catálogo/);
    expect(calls.killed).toEqual(["tok"]);
  });
  it("fails when pagination never ends instead of returning a silently truncated library", async () => {
    let n = 0;
    const { http, calls } = fake({ getJson: async (u) => (u.includes("/library/") ? { records: [], responseMetadata: { nextCursor: `c${n++}` } } : {}) });
    await expect(importEpicAccount("c".repeat(32), undefined, http)).rejects.toThrow(/páginas/);
    expect(calls.killed).toEqual(["tok"]);
  });
});

describe("login url", () => {
  it("points at the Epic redirect with the launcher client", () => {
    expect(EPIC_LOGIN_URL.startsWith("https://www.epicgames.com/id/login?redirectUrl=")).toBe(true);
    expect(decodeURIComponent(EPIC_LOGIN_URL)).toContain("responseType=code");
  });
});

describe("revoke failures are reported, not hidden", () => {
  it("warns when the session could not be killed, and still returns the library", async () => {
    const { http } = fake({ kill: async () => { throw new Error("HTTP 500"); } });
    const warnings: string[] = [];
    const out = await importEpicAccount("c".repeat(32), undefined, http, (m) => warnings.push(m));
    expect(out.length).toBeGreaterThan(0);
    expect(warnings).toHaveLength(1);
  });
});
