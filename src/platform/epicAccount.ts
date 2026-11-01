import { type EpicRecord, epicEntries, parseCatalogTitles, parseEpicToken, parseLibraryPage } from "../domain/epicAccount";
import type { DetectedEntry } from "../domain/types";
import { REVOKE_DEADLINE_MS, readJson, request } from "./accountHttp";

/**
 * Epic's public launcher OAuth client (the same one the Epic Games Launcher, Legendary and Heroic use).
 * It identifies the app, not the user; the user's own login produces the one-time code.
 */
const CLIENT_BASIC = "MzRhMDJjZjhmNDQxNGUyOWIxNTkyMTg3NmRhMzZmOWE6ZGFhZmJjY2M3Mzc3NDUwMzlkZmZlNTNkOTRmYzc2Y2Y=";
const CLIENT_ID = "34a02cf8f4414e29b15921876da36f9a";
const ACCOUNT = "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth";
const LIBRARY = "https://library-service.live.use1a.on.epicgames.com/library/api/public/items";
const CATALOG = "https://catalog-public-service-prod06.ol.epicgames.com/catalog/api/shared/namespace";

export const EPIC_LOGIN_URL = `https://www.epicgames.com/id/login?redirectUrl=${encodeURIComponent(`https://www.epicgames.com/id/api/redirect?clientId=${CLIENT_ID}&responseType=code`)}`;

const MAX_PAGES = 40;
const CATALOG_BATCH = 20;
const CATALOG_PARALLEL = 4;

export interface EpicHttp {
  postForm: (url: string, form: Record<string, string>) => Promise<unknown>;
  getJson: (url: string, bearer: string) => Promise<unknown>;
  kill: (token: string) => Promise<void>;
}

export const realEpicHttp: EpicHttp = {
  postForm: async (url, form) =>
    readJson(await request(url, {
      method: "POST",
      headers: { Authorization: `Basic ${CLIENT_BASIC}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    })),
  getJson: async (url, bearer) => readJson(await request(url, { headers: { Authorization: `Bearer ${bearer}` } })),
  kill: async (token) => {
    const { res } = await request(`${ACCOUNT}/sessions/kill/${encodeURIComponent(token)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }, REVOKE_DEADLINE_MS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  },
};

async function listRecords(http: EpicHttp, token: string): Promise<EpicRecord[]> {
  const all: EpicRecord[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const qs = new URLSearchParams({ includeMetadata: "true", platform: "Windows" });
    if (cursor) qs.set("cursor", cursor);
    const { records, nextCursor } = parseLibraryPage(await http.getJson(`${LIBRARY}?${qs}`, token));
    all.push(...records);
    if (!nextCursor || nextCursor === cursor) return all;
    cursor = nextCursor;
  }
  throw new Error(`A biblioteca passou de ${MAX_PAGES} páginas: leitura interrompida para não importar uma lista incompleta.`);
}

async function resolveTitles(http: EpicHttp, token: string, records: EpicRecord[], onProgress?: (done: number, total: number) => void) {
  const byNs = new Map<string, Set<string>>();
  for (const r of records) byNs.set(r.namespace, (byNs.get(r.namespace) ?? new Set()).add(r.catalogItemId));
  const jobs: Array<{ ns: string; ids: string[] }> = [];
  for (const [ns, ids] of byNs) {
    const list = [...ids];
    for (let i = 0; i < list.length; i += CATALOG_BATCH) jobs.push({ ns, ids: list.slice(i, i + CATALOG_BATCH) });
  }
  const titles = new Map<string, string>();
  let done = 0;
  let failed = 0;
  for (let i = 0; i < jobs.length; i += CATALOG_PARALLEL) {
    await Promise.all(jobs.slice(i, i + CATALOG_PARALLEL).map(async ({ ns, ids }) => {
      const qs = new URLSearchParams({ includeDLCDetails: "true", includeMainGameDetails: "true", country: "BR", locale: "pt-BR" });
      for (const id of ids) qs.append("id", id);
      try {
        for (const [k, v] of parseCatalogTitles(await http.getJson(`${CATALOG}/${encodeURIComponent(ns)}/bulk/items?${qs}`, token))) titles.set(k, v);
      } catch {
        // One namespace failing must not hide the rest; the caller fails if nothing resolved at all.
        failed++;
      }
      onProgress?.(++done, jobs.length);
    }));
  }
  return { titles, failed, total: jobs.length };
}

/**
 * Exchanges the one-time code for a short-lived token, reads the owned library, and revokes the
 * token. Nothing is stored: the user signs in again next time.
 */
export async function importEpicAccount(
  code: string,
  onProgress?: (done: number, total: number) => void,
  http: EpicHttp = realEpicHttp,
  onWarning?: (message: string) => void,
): Promise<DetectedEntry[]> {
  const token = parseEpicToken(await http.postForm(`${ACCOUNT}/token`, { grant_type: "authorization_code", code, token_type: "eg1" }));
  if (!token) throw new Error("A Epic não devolveu uma sessão. O código vale uma vez só: gere outro.");
  try {
    const records = await listRecords(http, token.accessToken);
    const { titles, failed, total } = await resolveTitles(http, token.accessToken, records, onProgress);
    if (records.length > 0 && titles.size === 0) {
      throw new Error(`A Epic listou ${records.length} jogos, mas o catálogo não respondeu (${failed}/${total} chamadas falharam). Tente de novo mais tarde.`);
    }
    return epicEntries(records, titles);
  } finally {
    await http.kill(token.accessToken).catch(() => onWarning?.("Não consegui encerrar a sessão na Epic. O token expira sozinho em poucas horas; se quiser, saia das sessões em epicgames.com/account."));
  }
}
