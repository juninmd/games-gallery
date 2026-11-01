import type { DetectedEntry } from "./types";

/**
 * Amazon Games account library. Flow and payloads follow the open-source Nile client
 * (nile/api/authorization.py, nile/api/library.py): OpenID + PKCE login on amazon.com, device
 * registration on api.amazon.com, then the AnimusEntitlementsService on gaming.amazon.com.
 */
export const DEVICE_TYPE = "A2UMVHOX7UP4V7";
export const APP_NAME = "AGSLauncher for Windows";
export const APP_VERSION = "1.0.0";
const MARKETPLACE = "ATVPDKIKX0DER";
const ENTITLEMENT_KEY_ID = "d5dc8b8b-86c8-4fc4-ae93-18c0def5314d";
export const PAGE_SIZE = 50;

export interface AmazonDevice {
  serial: string;
  verifier: string;
  clientId: string;
  challenge: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 && v.length <= 4096 ? v : undefined);

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/** RFC 7636 S256: base64url(SHA-256(verifier)) without padding. */
export async function pkceChallenge(verifier: string): Promise<string> {
  return b64url(await sha256(verifier));
}

/** Fresh serial + PKCE pair for one login attempt; none of it is reused or stored. */
export async function newDevice(): Promise<AmazonDevice> {
  const serial = hex(crypto.getRandomValues(new Uint8Array(16))).toUpperCase();
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const clientId = hex(new TextEncoder().encode(`${serial}#${DEVICE_TYPE}`));
  return { serial, verifier, clientId, challenge: await pkceChallenge(verifier) };
}

export function buildAuthUrl(device: AmazonDevice): string {
  const q = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.mode": "checkid_setup",
    "openid.oa2.scope": "device_auth_access",
    "openid.ns.oa2": "http://www.amazon.com/ap/ext/oauth/2",
    "openid.oa2.response_type": "code",
    "openid.oa2.code_challenge_method": "S256",
    "openid.oa2.client_id": `device:${device.clientId}`,
    "openid.oa2.code_challenge": device.challenge,
    language: "en_US",
    marketPlaceId: MARKETPLACE,
    "openid.return_to": "https://www.amazon.com",
    "openid.pape.max_auth_age": "0",
    "openid.assoc_handle": "amzn_sonic_games_launcher",
    pageId: "amzn_sonic_games_launcher",
  });
  return `https://amazon.com/ap/signin?${q}`;
}

/** The user pastes the address-bar URL they land on after signing in; only the one-time code is read from it. */
export function extractAuthorizationCode(pasted: string): string | null {
  try {
    const url = new URL(pasted.trim());
    if (url.protocol !== "https:" || (url.hostname !== "www.amazon.com" && url.hostname !== "amazon.com")) return null;
    const code = url.searchParams.get("openid.oa2.authorization_code");
    return code && /^[\w.~-]{8,512}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

export function registerBody(code: string, device: AmazonDevice): unknown {
  return {
    auth_data: {
      authorization_code: code,
      client_domain: "DeviceLegacy",
      client_id: device.clientId,
      code_algorithm: "SHA-256",
      code_verifier: device.verifier,
      use_global_authentication: false,
    },
    registration_data: {
      app_name: APP_NAME,
      app_version: APP_VERSION,
      device_model: "Windows",
      device_name: null,
      device_serial: device.serial,
      device_type: DEVICE_TYPE,
      domain: "Device",
      os_version: "10.0.19044.0",
    },
    requested_extensions: ["customer_info", "device_info"],
    requested_token_type: ["bearer", "mac_dms"],
    user_context_map: {},
  };
}

/** `response.success.tokens.bearer.access_token`; anything else means the registration was refused. */
export function parseRegistration(json: unknown): string | null {
  const success = isObj(json) && isObj(json["response"]) ? json["response"]["success"] : undefined;
  const tokens = isObj(success) ? success["tokens"] : undefined;
  const bearer = isObj(tokens) ? tokens["bearer"] : undefined;
  return (isObj(bearer) ? str(bearer["access_token"]) : undefined) ?? null;
}

export async function entitlementsBody(device: AmazonDevice, nextToken: string | null): Promise<unknown> {
  return {
    Operation: "GetEntitlements",
    clientId: "Sonic",
    syncPoint: null,
    nextToken,
    maxResults: PAGE_SIZE,
    productIdFilter: null,
    keyId: ENTITLEMENT_KEY_ID,
    hardwareHash: hex(await sha256(device.serial)).toUpperCase(),
  };
}

export interface AmazonPage {
  games: DetectedEntry[];
  nextToken?: string;
}

/**
 * One `GetEntitlements` page. Nile keeps every entitlement; the payload fields that would separate
 * DLC / Prime perks from games were not confirmed in its source, so only entries without a product
 * id or title are dropped here.
 */
export function parseEntitlements(json: unknown): AmazonPage {
  if (!isObj(json)) return { games: [] };
  const games: DetectedEntry[] = [];
  for (const raw of Array.isArray(json["entitlements"]) ? json["entitlements"] : []) {
    const product = isObj(raw) && isObj(raw["product"]) ? raw["product"] : undefined;
    const id = str(product?.["id"]);
    const title = str(product?.["title"])?.trim();
    if (!id || !title || !/^[\w.-]{1,200}$/.test(id)) continue;
    games.push({ storeId: id, title, installed: false });
  }
  return { games, nextToken: str(json["nextToken"]) };
}
