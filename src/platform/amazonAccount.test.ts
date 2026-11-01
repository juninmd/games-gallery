import { describe, expect, it } from "vitest";
import { newDevice } from "../domain/amazonAccount";
import { type AmazonHttp, importAmazonAccount } from "./amazonAccount";

const LANDING = "https://www.amazon.com/?openid.assoc_handle=amzn_sonic_games_launcher&openid.oa2.authorization_code=ANcode0123456789";
const product = (n: number) => ({ product: { id: `amzn1.adg.product.${n}`, title: `Game ${n}` } });

function fake(overrides: Partial<AmazonHttp> = {}) {
  const calls = { register: [] as unknown[], entitlements: [] as unknown[], deregistered: [] as string[] };
  const http: AmazonHttp = {
    register: async (b) => { calls.register.push(b); return { response: { success: { tokens: { bearer: { access_token: "tok" } } } } }; },
    entitlements: async (_t, b) => {
      calls.entitlements.push(b);
      return (b as { nextToken: string | null }).nextToken === null
        ? { entitlements: [product(1), product(2)], nextToken: "p2" }
        : { entitlements: [product(2), product(3)] };
    },
    deregister: async (t) => { calls.deregistered.push(t); },
    ...overrides,
  };
  return { http, calls };
}

describe("importAmazonAccount", () => {
  it("registers with the code, pages through entitlements, dedupes and deregisters", async () => {
    const device = await newDevice();
    const { http, calls } = fake();
    const out = await importAmazonAccount(LANDING, device, http);
    expect(out.map((g) => g.title)).toEqual(["Game 1", "Game 2", "Game 3"]);
    expect((calls.register[0] as { auth_data: { authorization_code: string } }).auth_data.authorization_code).toBe("ANcode0123456789");
    expect(calls.entitlements).toHaveLength(2);
    expect(calls.deregistered).toEqual(["tok"]);
  });
  it("rejects a URL without a code before any request", async () => {
    const { http, calls } = fake();
    await expect(importAmazonAccount("https://www.amazon.com/?x=1", await newDevice(), http)).rejects.toThrow(/código/);
    expect(calls.register).toHaveLength(0);
  });
  it("explains a refused registration and never calls the library", async () => {
    const { http, calls } = fake({ register: async () => ({ response: { error: { code: "invalid_grant" } } }) });
    await expect(importAmazonAccount(LANDING, await newDevice(), http)).rejects.toThrow(/uma vez só/);
    expect(calls.entitlements).toHaveLength(0);
    expect(calls.deregistered).toHaveLength(0);
  });
  it("deregisters even when the library call fails", async () => {
    const { http, calls } = fake({ entitlements: async () => { throw new Error("HTTP 500"); } });
    await expect(importAmazonAccount(LANDING, await newDevice(), http)).rejects.toThrow("HTTP 500");
    expect(calls.deregistered).toEqual(["tok"]);
  });
  it("fails instead of truncating when pagination never ends, and ignores a failing deregister", async () => {
    let n = 0;
    const { http, calls } = fake({
      entitlements: async () => ({ entitlements: [], nextToken: `t${n++}` }),
      deregister: async () => { throw new Error("HTTP 500"); },
    });
    await expect(importAmazonAccount(LANDING, await newDevice(), http)).rejects.toThrow(/páginas/);
    expect(calls.register).toHaveLength(1);
  });
});

describe("revoke failures are reported, not hidden", () => {
  it("warns when the temporary device could not be removed, and still returns the library", async () => {
    const { http } = fake({ deregister: async () => { throw new Error("HTTP 500"); } });
    const warnings: string[] = [];
    const out = await importAmazonAccount(LANDING, await newDevice(), http, (m) => warnings.push(m));
    expect(out).toHaveLength(3);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/dispositivo temporário/);
  });
});
