import { fold } from "./scan/fold";
import type { EpicInstallRecord } from "./scan/epic";
import { type ImportItem, planEpicImport, planSteamImport, planStoreImport } from "./scan/plan";
import type { DetectedEntry, Game, ProviderDetection } from "./types";

/** Turns one provider scan into reviewable import items, reusing the folder-scan planners. */
export function importItemsFrom(detection: ProviderDetection, games: Game[]): ImportItem[] {
  if (detection.providerId === "steam") {
    return planSteamImport(
      detection.games.flatMap((g) => {
        const appId = Number(g.storeId);
        return Number.isInteger(appId) && appId > 0 ? [{ appId, name: g.title, sizeGb: g.sizeGb, installed: g.installed }] : [];
      }),
      games,
    );
  }
  if (detection.providerId === "epic") {
    const records: EpicInstallRecord[] = detection.games.map((g) => ({
      appName: g.storeId,
      title: g.title,
      sizeGb: g.sizeGb,
      installed: g.installed,
      needsVerification: false,
      source: "item",
    }));
    return planEpicImport(records, games);
  }
  return planStoreImport(detection.providerId, detection.games, games);
}

/**
 * The Steam Web API lists the whole account; the local manifests are the only proof of what is
 * installed on this machine. Local data wins on `installed`/size, the API adds playtime.
 */
export function mergeDetections(local: DetectedEntry[], remote: DetectedEntry[]): DetectedEntry[] {
  const byId = new Map<string, DetectedEntry>();
  for (const entry of local) byId.set(entry.storeId, { ...entry });
  for (const entry of remote) {
    const current = byId.get(entry.storeId);
    if (current) {
      byId.set(entry.storeId, {
        ...current,
        playtimeH: entry.playtimeH ?? current.playtimeH,
        title: current.title || entry.title,
      });
    } else {
      byId.set(entry.storeId, { ...entry, installed: false, sizeGb: undefined });
    }
  }
  return [...byId.values()];
}

/** Summary text for a toast: what was found and how many games changed. */
export function detectionSummary(detections: ProviderDetection[]): string {
  const available = detections.filter((d) => d.available);
  const total = available.reduce((n, d) => n + d.games.length, 0);
  if (!available.length) return "Nenhuma biblioteca local encontrada.";
  const names = available.map((d) => `${d.providerId} (${d.games.length})`).join(", ");
  return `${total} jogo(s) encontrados: ${names}.`;
}

/**
 * Scanners of the same provider (launcher manifests + Legendary + account login) overlap. Merge them into
 * one detection per provider so a game is planned once; `installed` is true if any scanner proved it.
 */
export function combineDetections(detections: ProviderDetection[]): ProviderDetection[] {
  const out = new Map<string, ProviderDetection>();
  for (const d of detections) {
    const current = out.get(d.providerId);
    if (!current) {
      out.set(d.providerId, { ...d, games: d.available ? mergeById(d.providerId, [], d.games) : [] });
      continue;
    }
    out.set(d.providerId, {
      ...current,
      available: current.available || d.available,
      source: current.available && d.available ? `${current.source} + ${d.source}` : current.available ? current.source : d.available ? d.source : current.source,
      note: current.available || d.available ? undefined : current.note,
      games: d.available ? mergeById(d.providerId, current.games, d.games) : current.games,
    });
  }
  return [...out.values()];
}

/** Only these launchers expose the same game under two id systems (local registry id vs the store account's space/offer id). */
const TITLE_MERGE = new Set(["ubisoft", "ea", "battlenet"]);

function mergeById(providerId: string, base: DetectedEntry[], extra: DetectedEntry[]): DetectedEntry[] {
  const byKey = new Map<string, DetectedEntry>();
  const idToKey = new Map<string, string>();
  // Same title under two ids is one game only where the id systems differ; the first id wins.
  for (const e of [...base, ...extra]) {
    const folded = fold(e.title);
    const key = idToKey.get(e.storeId) ?? (TITLE_MERGE.has(providerId) && folded ? `t:${folded}` : `id:${e.storeId}`);
    idToKey.set(e.storeId, key);
    const prev = byKey.get(key);
    byKey.set(key, prev ? { ...prev, installed: prev.installed || e.installed, sizeGb: prev.sizeGb ?? e.sizeGb, installPath: prev.installPath ?? e.installPath, playtimeH: prev.playtimeH ?? e.playtimeH } : e);
  }
  return [...byKey.values()];
}

/**
 * Launch URIs and backups only accept `[\w.-]+` ids; some scanners fall back to a title or a key with
 * spaces/colons. Slug those once, at the boundary, so the id survives a restart and stays launchable.
 */
export function safeStoreId(raw: string): string {
  if (/^[\w.-]+$/.test(raw) && !/^\.{1,2}$/.test(raw)) return raw;
  const slug = raw.trim().replace(/[^\w.-]+/g, "-").replace(/^[-.]+|-+$/g, "");
  return slug || "unknown";
}
