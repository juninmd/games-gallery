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
  /** Absent in the file = keep the current value on restore (never wipe what the backup does not describe). */
  providers?: Record<string, { connected: boolean; lastSync?: string }>;
  emulators?: Record<string, boolean>;
  /** Missing or invalid fields preserve the current setting; an empty string explicitly clears it. */
  settings: Partial<{ romsDir: string; emulatorsDir: string }>;
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
export function sanitizeGame(raw: unknown, profile: "backup" | "storage" = "backup"): Game | null {
  if (!isObj(raw)) return null;
  const text = (v: unknown, max: number) => str(v, profile === "backup" ? max : Number.POSITIVE_INFINITY);
  const number = (v: unknown, min: number, max: number) => num(v, min, profile === "backup" ? max : Number.POSITIVE_INFINITY);
  const id = text(raw["id"], 200);
  const title = text(raw["title"], 300)?.trim();
  const platformId = text(raw["platformId"], 500);
  const providerId = text(raw["providerId"], 500);
  const status = STATUS_ORDER.find((s) => s === raw["status"]);
  if (!id || !title || !platformId || !providerId || !status) return null;
  if (!has(PLATFORM_BY_ID, platformId) || !has(PROVIDER_BY_ID, providerId)) return null;
  if (typeof raw["owned"] !== "boolean" || typeof raw["installed"] !== "boolean") return null;
  // App invariant: owned <=> not wishlist, and nothing unowned can be installed.
  const owned = status !== "wishlist";
  const storeId = text(raw["storeId"], 100);
  const emulatorId = text(raw["emulatorId"], 500);
  const coverUrl = text(raw["coverUrl"], 1000);
  const rawGenres = Array.isArray(raw["genres"]) ? raw["genres"].flatMap((g) => (text(g, 60) ? [g as string] : [])) : [];
  const genres = profile === "backup" ? rawGenres.slice(0, 12) : rawGenres;
  return {
    id, title, platformId, providerId, status, owned,
    installed: owned && raw["installed"],
    storeId: storeId && SAFE_STORE_ID.test(storeId) ? storeId : undefined,
    steamAppId: number(raw["steamAppId"], 1, 2 ** 31),
    year: number(raw["year"], 0, 3000) ?? 0,
    genres,
    coverUrl: coverUrl?.startsWith("https://") ? coverUrl : undefined,
    sizeGb: number(raw["sizeGb"], 0, 100_000),
    playtimeH: number(raw["playtimeH"], 0, 1_000_000) ?? 0,
    rating: number(raw["rating"], 1, 5),
    romPath: text(raw["romPath"], 2000),
    emulatorId: emulatorId && has(EMULATOR_BY_ID, emulatorId) ? emulatorId : undefined,
    notes: text(raw["notes"], 5000),
  };
}

export function sanitizeScans(raw: unknown, profile: "backup" | "storage" = "backup"): BackupScan[] {
  if (!Array.isArray(raw)) return [];
  const text = (v: unknown, max: number) => str(v, profile === "backup" ? max : Number.POSITIVE_INFINITY);
  const seen = new Set<string>();
  return (profile === "backup" ? raw.slice(0, MAX_SCANS) : raw).flatMap((s): BackupScan[] => {
    if (!isObj(s)) return [];
    const kind = s["kind"] === "roms" || s["kind"] === "games" ? s["kind"] : undefined;
    const id = text(s["id"], 60), name = text(s["name"], 300), at = text(s["at"], 60);
    if (!kind || !id || !name || !at || seen.has(id)) return [];
    seen.add(id);
    const added = num(s["added"], 0, profile === "backup" ? MAX_GAMES : Number.POSITIVE_INFINITY) ?? 0;
    const linked = num(s["linked"], 0, profile === "backup" ? MAX_GAMES : Number.POSITIVE_INFINITY) ?? 0;
    return [{ id, kind, name, at, path: text(s["path"], 2000), added, linked }];
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
    const g = sanitizeGame(raw);
    if (!g || seen.has(g.id)) { dropped++; continue; }
    seen.add(g.id);
    games.push(g);
  }
  dropped += Math.max(0, json["games"].length - MAX_GAMES);
  // An explicitly empty exported library is valid; a nonempty file that sanitizes to nothing is not.
  if (json["games"].length > 0 && !games.length) return { ok: false, error: "O backup não contém nenhum jogo válido." };

  let providers: BackupData["providers"];
  if (isObj(json["providers"])) {
    providers = {};
    for (const [id, v] of Object.entries(json["providers"])) {
      if (has(PROVIDER_BY_ID, id) && isObj(v) && typeof v["connected"] === "boolean") providers[id] = { connected: v["connected"], lastSync: str(v["lastSync"], 60) };
    }
  }
  let emulators: BackupData["emulators"];
  if (isObj(json["emulators"])) {
    const known: Record<string, boolean> = {};
    for (const [id, v] of Object.entries(json["emulators"])) if (has(EMULATOR_BY_ID, id) && typeof v === "boolean") known[id] = v;
    emulators = known;
  }
  const s = isObj(json["settings"]) ? json["settings"] : {};
  const settings: BackupData["settings"] = {};
  const romsDir = str(s["romsDir"], 1000);
  const emulatorsDir = str(s["emulatorsDir"], 1000);
  if (romsDir !== undefined) settings.romsDir = romsDir;
  if (emulatorsDir !== undefined) settings.emulatorsDir = emulatorsDir;
  return { ok: true, data: { games, scans: sanitizeScans(json["scans"]), providers, emulators, settings }, dropped };
}
