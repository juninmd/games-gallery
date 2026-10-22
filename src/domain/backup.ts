import { EMULATOR_BY_ID } from "./emulators";
import { PLATFORM_BY_ID } from "./platforms";
import { PROVIDER_BY_ID } from "./providers";
import { STATUS_ORDER } from "./status";
import type { Game } from "./types";

export const BACKUP_APP = "games-gallery";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;
const MAX_GAMES = 20_000;
const MAX_SCANS = 50;

export interface BackupScan {
  id: string;
  kind: "roms" | "games";
  name: string;
  path?: string;
  at: string;
  added: number;
  linked: number;
}

export interface BackupData {
  games: Game[];
  scans: BackupScan[];
  providers: Record<string, { connected: boolean; lastSync?: string }>;
  emulators: Record<string, boolean>;
  settings: { romsDir: string; emulatorsDir: string };
}

export type ParseResult =
  | { ok: true; data: BackupData; dropped: number }
  | { ok: false; error: string };

/** Only library data: API keys and cached public ratings are deliberately not part of a backup. */
export function exportBackup(data: BackupData, now = new Date()): string {
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), ...data }, null, 2);
}

/** Catalog lookups are plain objects: "constructor" or "__proto__" must not count as ids. */
const has = (rec: object, key: string) => Object.prototype.hasOwnProperty.call(rec, key);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 500): string | undefined => (typeof v === "string" && v.length <= max ? v : undefined);
const num = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
// Same rule launch.ts applies before a store id reaches a URI.
const SAFE_STORE_ID = /^[\w.-]+$/;

/** Rebuilds a game from known fields only; returns null when a required field is invalid. */
function cleanGame(raw: unknown): Game | null {
  if (!isObj(raw)) return null;
  const id = str(raw["id"], 200);
  const title = str(raw["title"], 300)?.trim();
  const platformId = str(raw["platformId"]);
  const providerId = str(raw["providerId"]);
  const status = STATUS_ORDER.find((s) => s === raw["status"]);
  if (!id || !title || !platformId || !providerId || !status) return null;
  if (!has(PLATFORM_BY_ID, platformId) || !has(PROVIDER_BY_ID, providerId)) return null;
  if (typeof raw["owned"] !== "boolean" || typeof raw["installed"] !== "boolean") return null;
  // Wishlist means not owned, and nothing unowned can be installed.
  const owned = status === "wishlist" ? false : raw["owned"];
  const storeId = str(raw["storeId"], 100);
  const emulatorId = str(raw["emulatorId"]);
  const coverUrl = str(raw["coverUrl"], 1000);
  const genres = Array.isArray(raw["genres"]) ? raw["genres"].flatMap((g) => (str(g, 60) ? [g as string] : [])).slice(0, 12) : [];
  return {
    id, title, platformId, providerId, status, owned,
    installed: owned && raw["installed"],
    storeId: storeId && SAFE_STORE_ID.test(storeId) ? storeId : undefined,
    steamAppId: num(raw["steamAppId"], 1, 2 ** 31),
    year: num(raw["year"], 0, 3000) ?? 0,
    genres,
    coverUrl: coverUrl?.startsWith("https://") ? coverUrl : undefined,
    sizeGb: num(raw["sizeGb"], 0, 100_000),
    playtimeH: num(raw["playtimeH"], 0, 1_000_000) ?? 0,
    rating: num(raw["rating"], 1, 5),
    romPath: str(raw["romPath"], 2000),
    emulatorId: emulatorId && has(EMULATOR_BY_ID, emulatorId) ? emulatorId : undefined,
    notes: str(raw["notes"], 5000),
  };
}

function cleanScans(raw: unknown): BackupScan[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_SCANS).flatMap((s): BackupScan[] => {
    if (!isObj(s)) return [];
    const kind = s["kind"] === "roms" || s["kind"] === "games" ? s["kind"] : undefined;
    const id = str(s["id"], 60), name = str(s["name"], 300), at = str(s["at"], 60);
    if (!kind || !id || !name || !at) return [];
    return [{ id, kind, name, at, path: str(s["path"], 2000), added: num(s["added"], 0, MAX_GAMES) ?? 0, linked: num(s["linked"], 0, MAX_GAMES) ?? 0 }];
  });
}

/** Validates untrusted file text; never throws. */
export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: "Arquivo grande demais para ser um backup." };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "O arquivo não é um JSON válido." };
  }
  if (!isObj(json) || json["app"] !== BACKUP_APP) return { ok: false, error: "Este arquivo não é um backup do Games Gallery." };
  const version = json["version"];
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return { ok: false, error: "Versão do backup inválida." };
  if (version > BACKUP_VERSION) return { ok: false, error: `Backup da versão ${version}: atualize o app para importar.` };
  if (!Array.isArray(json["games"])) return { ok: false, error: "O backup não contém a lista de jogos." };

  const seen = new Set<string>();
  const games: Game[] = [];
  let dropped = 0;
  for (const raw of json["games"].slice(0, MAX_GAMES)) {
    const g = cleanGame(raw);
    if (!g || seen.has(g.id)) { dropped++; continue; }
    seen.add(g.id);
    games.push(g);
  }
  dropped += Math.max(0, json["games"].length - MAX_GAMES);

  const providers: BackupData["providers"] = {};
  if (isObj(json["providers"])) {
    for (const [id, v] of Object.entries(json["providers"])) {
      if (has(PROVIDER_BY_ID, id) && isObj(v) && typeof v["connected"] === "boolean") providers[id] = { connected: v["connected"], lastSync: str(v["lastSync"], 60) };
    }
  }
  const emulators: BackupData["emulators"] = {};
  if (isObj(json["emulators"])) {
    for (const [id, v] of Object.entries(json["emulators"])) if (has(EMULATOR_BY_ID, id) && typeof v === "boolean") emulators[id] = v;
  }
  const s = isObj(json["settings"]) ? json["settings"] : {};
  const settings = { romsDir: str(s["romsDir"], 1000) ?? "", emulatorsDir: str(s["emulatorsDir"], 1000) ?? "" };
  return { ok: true, data: { games, scans: cleanScans(json["scans"]), providers, emulators, settings }, dropped };
}
