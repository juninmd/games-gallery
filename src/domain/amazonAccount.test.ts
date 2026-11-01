import { describe, expect, it } from "vitest";
import { buildAuthUrl, DEVICE_TYPE, entitlementsBody, extractAuthorizationCode, newDevice, parseEntitlements, parseRegistration, pkceChallenge, registerBody } from "./amazonAccount";

describe("PKCE", () => {
  it("matches the RFC 7636 appendix B vector", async () => {
    expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
  it("generates a fresh, well-formed device each time", async () => {
    const a = await newDevice();
    const b = await newDevice();
    expect(a.serial).toMatch(/^[0-9A-F]{32}$/);
    expect(a.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.verifier).not.toBe(b.verifier);
    // client id is the hex of "<serial>#<deviceType>"
    const decoded = a.clientId.match(/../g)?.map((h) => String.fromCharCode(parseInt(h, 16))).join("");
    expect(decoded).toBe(`${a.serial}#${DEVICE_TYPE}`);
    expect(a.challenge).toBe(await pkceChallenge(a.verifier));
  });
});

describe("buildAuthUrl", () => {
  it("is an amazon.com sign-in with S256 and the device client id, never the verifier", async () => {
    const d = await newDevice();
    const url = new URL(buildAuthUrl(d));
    expect(`${url.origin}${url.pathname}`).toBe("https://amazon.com/ap/signin");
    expect(url.searchParams.get("openid.oa2.code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("openid.oa2.client_id")).toBe(`device:${d.clientId}`);
    expect(url.searchParams.get("openid.oa2.code_challenge")).toBe(d.challenge);
    expect(url.toString()).not.toContain(d.verifier);
  });
});

describe("extractAuthorizationCode", () => {
  const ok = "https://www.amazon.com/?openid.assoc_handle=amzn_sonic_games_launcher&openid.oa2.authorization_code=ANabc123XYZ.def-456&openid.mode=id_res";
  it("reads only the one-time code from the landing URL", () => {
    expect(extractAuthorizationCode(ok)).toBe("ANabc123XYZ.def-456");
    expect(extractAuthorizationCode(`  ${ok}  `)).toBe("ANabc123XYZ.def-456");
  });
  it("rejects other hosts, schemes, missing or malformed codes", () => {
    for (const bad of ["", "not a url", "http://www.amazon.com/?openid.oa2.authorization_code=ANabc123XYZ", "https://evil.example/?openid.oa2.authorization_code=ANabc123XYZ", "https://www.amazon.com/?x=1", "https://www.amazon.com/?openid.oa2.authorization_code=a b", "https://www.amazon.com/?openid.oa2.authorization_code=short"]) {
      expect(extractAuthorizationCode(bad), bad).toBeNull();
    }
  });
});

describe("registration", () => {
  it("builds the device-registration body from the code and the device", async () => {
    const d = await newDevice();
    const body = registerBody("CODE12345", d) as { auth_data: Record<string, unknown>; registration_data: Record<string, unknown> };
    expect(body.auth_data).toMatchObject({ authorization_code: "CODE12345", code_verifier: d.verifier, client_id: d.clientId, code_algorithm: "SHA-256" });
    expect(body.registration_data).toMatchObject({ device_serial: d.serial, device_type: DEVICE_TYPE });
  });
  it("extracts the bearer token and refuses anything else", () => {
    expect(parseRegistration({ response: { success: { tokens: { bearer: { access_token: "tok", refresh_token: "r" } } } } })).toBe("tok");
    for (const bad of [null, {}, { response: {} }, { response: { error: { code: "x" } } }, { response: { success: { tokens: {} } } }]) expect(parseRegistration(bad)).toBeNull();
  });
});

describe("entitlements", () => {
  it("hashes the serial for the hardware hash and pages with nextToken", async () => {
    const d = await newDevice();
    const body = (await entitlementsBody(d, "NEXT")) as Record<string, unknown>;
    expect(body).toMatchObject({ Operation: "GetEntitlements", nextToken: "NEXT", maxResults: 50 });
    expect(body["hardwareHash"]).toMatch(/^[0-9A-F]{64}$/);
  });
  it("keeps entries with an id and a title and returns the next token", () => {
    const page = parseEntitlements({
      entitlements: [
        { product: { id: "amzn1.adg.product.aaaa-bbbb", title: "  Fake Game  " } },
        { product: { id: "amzn1.adg.product.cccc", title: "" } },
        { product: { title: "No Id" } },
        { product: { id: "bad id!", title: "Bad" } },
        null,
      ],
      nextToken: "tok2",
    });
    expect(page.games).toEqual([{ storeId: "amzn1.adg.product.aaaa-bbbb", title: "Fake Game", installed: false }]);
    expect(page.nextToken).toBe("tok2");
  });
  it("never throws on junk", () => {
    for (const bad of [null, "x", [], {}, { entitlements: "no" }]) expect(parseEntitlements(bad).games).toEqual([]);
  });
});
