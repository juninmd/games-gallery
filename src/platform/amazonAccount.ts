import { type AmazonDevice, APP_NAME, APP_VERSION, entitlementsBody, extractAuthorizationCode, parseEntitlements, parseRegistration, registerBody } from "../domain/amazonAccount";
import type { DetectedEntry } from "../domain/types";
import { REVOKE_DEADLINE_MS, readJson, request } from "./accountHttp";

const REGISTER = "https://api.amazon.com/auth/register";
const DEREGISTER = "https://api.amazon.com/auth/deregister";
const ENTITLEMENTS = "https://gaming.amazon.com/api/distribution/entitlements";
const MAX_PAGES = 40;

export interface AmazonHttp {
  register: (body: unknown) => Promise<unknown>;
  entitlements: (token: string, body: unknown) => Promise<unknown>;
  deregister: (token: string) => Promise<void>;
}

const JSON_HEADERS = { "Content-Type": "application/json", "User-Agent": "AGSLauncher/1.0.0" };

export const realAmazonHttp: AmazonHttp = {
  register: async (body) => readJson(await request(REGISTER, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) })),
  entitlements: async (token, body) =>
    readJson(await request(ENTITLEMENTS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "amz-1.0",
        "X-Amz-Target": "com.amazon.animusdistributionservice.entitlement.AnimusEntitlementsService.GetEntitlements",
        "x-amzn-token": token,
        // Sent under this exact name by the official launcher clients Nile mimics.
        UserAgent: "com.amazon.agslauncher.win/3.0.9202.1",
      },
      body: JSON.stringify(body),
    })),
  deregister: async (token) => {
    const { res } = await request(DEREGISTER, {
      method: "POST",
      headers: { ...JSON_HEADERS, Authorization: `bearer ${token}` },
      body: JSON.stringify({ request_metadata: { app_name: APP_NAME, app_version: APP_VERSION } }),
    }, REVOKE_DEADLINE_MS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  },
};

/**
 * Exchanges the one-time code (read from the URL the user pasted) for a device token, lists the
 * entitlements, then deregisters the device so nothing is left on Amazon's side or on this machine.
 */
export async function importAmazonAccount(
  pastedUrl: string,
  device: AmazonDevice,
  http: AmazonHttp = realAmazonHttp,
  onWarning?: (message: string) => void,
): Promise<DetectedEntry[]> {
  const code = extractAuthorizationCode(pastedUrl);
  if (!code) throw new Error("Não achei o código na URL colada. Cole o endereço completo da página para onde a Amazon te levou após o login.");
  const token = parseRegistration(await http.register(registerBody(code, device)));
  if (!token) throw new Error("A Amazon recusou o registro. O código vale uma vez só: abra o login de novo.");
  try {
    const games = new Map<string, DetectedEntry>();
    let next: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = parseEntitlements(await http.entitlements(token, await entitlementsBody(device, next)));
      for (const g of result.games) if (!games.has(g.storeId)) games.set(g.storeId, g);
      if (!result.nextToken || result.nextToken === next) return [...games.values()];
      next = result.nextToken;
    }
    throw new Error(`A biblioteca passou de ${MAX_PAGES} páginas: leitura interrompida para não importar uma lista incompleta.`);
  } finally {
    await http.deregister(token).catch(() => onWarning?.("Não consegui remover o dispositivo temporário da sua conta Amazon. Remova-o em amazon.com → Conta → Conteúdo e dispositivos, se aparecer lá."));
  }
}
