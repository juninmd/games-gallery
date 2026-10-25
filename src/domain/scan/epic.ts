export type EpicMetadataSource = "item" | "legendary";

export interface EpicInstallRecord {
  appName: string;
  title: string;
  sizeGb?: number;
  needsVerification: boolean;
  source: EpicMetadataSource;
}

export type EpicItemParse =
  | { kind: "entry"; entry: EpicInstallRecord }
  | { kind: "skip"; reason: "dlc" | "incomplete" | "invalid" };

export const MAX_EPIC_ITEM_BYTES = 1 * 1024 * 1024;
export const MAX_LEGENDARY_INSTALLED_BYTES = 8 * 1024 * 1024;
export const MAX_EPIC_TOTAL_BYTES = 64 * 1024 * 1024;
export const MAX_EPIC_METADATA_FILES = 5_000;

const asObject = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;
const nonempty = (v: unknown): string | undefined => typeof v === "string" && v.trim() ? v.trim() : undefined;
const safeAppName = (v: unknown): string | undefined => {
  const s = nonempty(v);
  return s && s.length <= 100 && /^[\w.-]+$/.test(s) ? s : undefined;
};
const sizeGb = (v: unknown): number | undefined => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return undefined;
  return Math.round((v / 1024 ** 3) * 10) / 10;
};
const optionalSizeValid = (raw: Record<string, unknown>, key: string) =>
  !(key in raw) || (typeof raw[key] === "number" && Number.isFinite(raw[key]) && (raw[key] as number) >= 0);
const json = (text: string): unknown => {
  try { return JSON.parse(text) as unknown; } catch { return undefined; }
};

/** Exact allow-list: local Epic `.item` files and a file named exactly `installed.json`. */
export const isEpicItemPath = (path: string) => /(^|\/)[^/]+\.item$/i.test(path.replace(/\\/g, "/"));
export const isLegendaryInstalledPath = (path: string) => /(^|\/)installed\.json$/i.test(path.replace(/\\/g, "/"));

/** Reads only the known game metadata fields; launcher flags and credentials are ignored. */
export function parseEpicItem(text: string): EpicItemParse {
  const raw = asObject(json(text));
  if (!raw) return { kind: "skip", reason: "invalid" };
  const appName = safeAppName(raw["AppName"]);
  const title = nonempty(raw["DisplayName"]);
  const installLocation = nonempty(raw["InstallLocation"]);
  if (!appName || !title || !installLocation) return { kind: "skip", reason: "invalid" };
  if (!optionalSizeValid(raw, "InstallSize")) return { kind: "skip", reason: "invalid" };
  const baseApp = nonempty(raw["MainGameAppName"]);
  if (baseApp && baseApp !== appName) return { kind: "skip", reason: "dlc" };
  if (raw["bIsIncompleteInstall"] === true) return { kind: "skip", reason: "incomplete" };
  return {
    kind: "entry",
    entry: { appName, title, sizeGb: sizeGb(raw["InstallSize"]), needsVerification: false, source: "item" },
  };
}

export interface LegendaryParse {
  entries: EpicInstallRecord[];
  invalid: number;
  dlc: number;
}

/** `installed.json` is an app-name keyed object; only the installed-record allow-list is read. */
export function parseLegendaryInstalled(text: string): LegendaryParse | null {
  const root = asObject(json(text));
  if (!root) return null;
  const entries: EpicInstallRecord[] = [];
  let invalid = 0;
  let dlc = 0;
  for (const value of Object.values(root)) {
    const raw = asObject(value);
    if (!raw) { invalid++; continue; }
    if (raw["is_dlc"] === true) { dlc++; continue; }
    const appName = safeAppName(raw["app_name"]);
    const title = nonempty(raw["title"]);
    const installPath = nonempty(raw["install_path"]);
    if (!appName || !title || !installPath) { invalid++; continue; }
    if (!optionalSizeValid(raw, "install_size")) { invalid++; continue; }
    entries.push({
      appName,
      title,
      sizeGb: sizeGb(raw["install_size"]),
      needsVerification: raw["needs_verification"] === true,
      source: "legendary",
    });
  }
  return { entries, invalid, dlc };
}

export interface EpicMetadataListing {
  files: string[];
  readText: (path: string) => Promise<string>;
  /** Optional selected-file size lookup; never called for install paths from metadata. */
  fileSize?: (path: string) => Promise<number | undefined>;
}

export interface EpicMetadataScan {
  entries: EpicInstallRecord[];
  notes: string[];
}

/** Bounded allow-list reader for the explicitly chosen metadata folder. */
export async function scanEpicMetadata(listing: EpicMetadataListing): Promise<EpicMetadataScan> {
  const itemPaths = listing.files.filter(isEpicItemPath).sort();
  const legendaryPaths = listing.files.filter(isLegendaryInstalledPath).sort();
  const files = [
    ...itemPaths.map((path) => ({ path, maxBytes: MAX_EPIC_ITEM_BYTES, type: "item" as const })),
    ...(legendaryPaths[0] ? [{ path: legendaryPaths[0], maxBytes: MAX_LEGENDARY_INSTALLED_BYTES, type: "legendary" as const }] : []),
  ];
  const entries: EpicInstallRecord[] = [];
  const counts = { invalid: 0, dlc: 0, incomplete: 0, oversized: 0, unreadable: 0, aggregate: 0, fileLimit: 0, duplicate: 0 };
  if (!files.length) return { entries, notes: ["Nenhum arquivo .item ou installed.json encontrado na pasta escolhida."] };
  if (legendaryPaths.length > 1) counts.invalid += legendaryPaths.length - 1;
  if (files.length > MAX_EPIC_METADATA_FILES) counts.fileLimit = files.length - MAX_EPIC_METADATA_FILES;

  let totalBytes = 0;
  const boundedFiles = files.slice(0, MAX_EPIC_METADATA_FILES);
  for (let index = 0; index < boundedFiles.length; index++) {
    const file = boundedFiles[index]!;
    let knownSize: number | undefined;
    try { knownSize = await listing.fileSize?.(file.path); } catch { counts.unreadable++; continue; }
    if (knownSize !== undefined && (!Number.isFinite(knownSize) || knownSize < 0 || knownSize > file.maxBytes)) {
      counts.oversized++;
      continue;
    }
    if (knownSize !== undefined && totalBytes + knownSize > MAX_EPIC_TOTAL_BYTES) {
      counts.aggregate += boundedFiles.length - index;
      break;
    }
    let text: string;
    try { text = await listing.readText(file.path); } catch { counts.unreadable++; continue; }
    if (text.length > file.maxBytes) { counts.oversized++; continue; }
    const bytes = new TextEncoder().encode(text).byteLength;
    if (bytes > file.maxBytes) { counts.oversized++; continue; }
    if (totalBytes + bytes > MAX_EPIC_TOTAL_BYTES) {
      counts.aggregate += boundedFiles.length - index;
      break;
    }
    totalBytes += Math.max(bytes, knownSize ?? bytes);
    if (file.type === "item") {
      const result = parseEpicItem(text);
      if (result.kind === "entry") entries.push(result.entry);
      else counts[result.reason]++;
    } else {
      const result = parseLegendaryInstalled(text);
      if (!result) counts.invalid++;
      else { entries.push(...result.entries); counts.invalid += result.invalid; counts.dlc += result.dlc; }
    }
  }

  const seenAppNames = new Set<string>();
  const uniqueEntries = entries.filter((entry) => {
    if (seenAppNames.has(entry.appName)) { counts.duplicate++; return false; }
    seenAppNames.add(entry.appName);
    return true;
  });
  const notes: string[] = [];
  if (counts.fileLimit) notes.push(`${counts.fileLimit} arquivo(s) excederam o limite de arquivos de metadados.`);
  if (counts.aggregate) notes.push(`${counts.aggregate} arquivo(s) não lidos porque o limite agregado de bytes foi atingido.`);
  if (counts.oversized) notes.push(`${counts.oversized} arquivo(s) de metadados excederam o limite de tamanho e foram ignorados.`);
  if (counts.unreadable) notes.push(`${counts.unreadable} arquivo(s) de metadados não puderam ser lidos.`);
  if (counts.invalid) notes.push(`${counts.invalid} entrada(s) de metadados inválidas foram ignoradas.`);
  if (counts.duplicate) notes.push(`${counts.duplicate} manifesto(s) repetido(s) foram ignorados.`);
  if (counts.dlc) notes.push(`${counts.dlc} DLC(s) foram ignorados.`);
  if (counts.incomplete) notes.push(`${counts.incomplete} instalação(ões) incompleta(s) foram ignoradas.`);
  if (uniqueEntries.some((entry) => entry.needsVerification)) notes.push("Algumas instalações estão registradas como instaladas, mas o Legendary indica que precisam de verificação.");
  return { entries: uniqueEntries, notes };
}
