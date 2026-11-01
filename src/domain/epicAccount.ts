import type { DetectedEntry } from "./types";

/** Epic account library: pure parsers for the launcher's own web services (payloads as legendary/Heroic read them). */
export interface EpicRecord {
  namespace: string;
  catalogItemId: string;
  appName: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 && v.length <= 300 ? v : undefined);
// No `.`/`..`: ids are interpolated into URL paths.
const ID = /^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100}$/;

export interface EpicToken {
  accessToken: string;
  accountId: string;
}

export function parseEpicToken(json: unknown): EpicToken | null {
  if (!isObj(json)) return null;
  const accessToken = str(json["access_token"]);
  const accountId = str(json["account_id"]);
  return accessToken && accountId ? { accessToken, accountId } : null;
}

/** The redirect page shows `{"authorizationCode":"…"}`; users paste either that JSON or just the code. */
export function extractAuthCode(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  let candidate = text;
  if (text.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(text);
      candidate = isObj(parsed) ? (str(parsed["authorizationCode"]) ?? "") : "";
    } catch {
      return null;
    }
  }
  candidate = candidate.replace(/^["']|["']$/g, "");
  return /^[a-f0-9]{32}$/i.test(candidate) ? candidate : null;
}

/** One page of `/library/api/public/items`: games only (no engine/tools), plus the next cursor. */
export function parseLibraryPage(json: unknown): { records: EpicRecord[]; nextCursor?: string } {
  if (!isObj(json)) return { records: [] };
  const records: EpicRecord[] = [];
  for (const raw of Array.isArray(json["records"]) ? json["records"] : []) {
    if (!isObj(raw)) continue;
    const namespace = str(raw["namespace"]);
    const catalogItemId = str(raw["catalogItemId"]);
    const appName = str(raw["appName"]);
    if (!namespace || !catalogItemId || !appName || !ID.test(namespace) || !ID.test(catalogItemId) || !ID.test(appName)) continue;
    if (raw["sandboxType"] !== "PUBLIC") continue;
    if (raw["recordType"] !== undefined && raw["recordType"] !== "APPLICATION") continue;
    records.push({ namespace, catalogItemId, appName });
  }
  const meta = json["responseMetadata"];
  const nextCursor = isObj(meta) ? str(meta["nextCursor"]) : undefined;
  return { records, nextCursor };
}

/** Catalog bulk response: `{ [catalogItemId]: { title, categories, mainGameItem } }`. DLC and add-ons are dropped. */
export function parseCatalogTitles(json: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!isObj(json)) return out;
  for (const [id, raw] of Object.entries(json)) {
    if (!isObj(raw) || !ID.test(id)) continue;
    const title = str(raw["title"])?.trim();
    if (!title) continue;
    const categories = Array.isArray(raw["categories"]) ? raw["categories"] : [];
    const paths = categories.flatMap((c) => (isObj(c) && typeof c["path"] === "string" ? [c["path"]] : []));
    if (paths.some((p) => p === "addons" || p === "addons/durable" || p === "digitalextras" || p === "applications/ue")) continue;
    if (isObj(raw["mainGameItem"])) continue;
    out.set(id, title);
  }
  return out;
}

/** Records + titles -> detected entries. Anything without a resolved title is skipped, never invented. */
export function epicEntries(records: EpicRecord[], titles: Map<string, string>): DetectedEntry[] {
  const seen = new Set<string>();
  const out: DetectedEntry[] = [];
  for (const r of records) {
    const title = titles.get(r.catalogItemId);
    if (!title || seen.has(r.appName)) continue;
    seen.add(r.appName);
    out.push({ storeId: r.appName, title, installed: false });
  }
  return out;
}
