import { fold } from "./scan/fold";

/** Community and platform compatibility data. All of it is third-party and best effort: it is shown as a hint, never as a promise. */
export type ProtonTier = "platinum" | "gold" | "silver" | "bronze" | "borked" | "pending";
export interface ProtonInfo {
  tier: ProtonTier;
  /** Number of community reports behind the tier. */
  total: number;
}

export type DeckStatus = "verified" | "playable" | "unsupported" | "unknown";

const TIERS: ProtonTier[] = ["platinum", "gold", "silver", "bronze", "borked", "pending"];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export const PROTON_LABEL: Record<ProtonTier, string> = {
  platinum: "Platina", gold: "Ouro", silver: "Prata", bronze: "Bronze", borked: "Não roda", pending: "Sem avaliação",
};
export const DECK_LABEL: Record<DeckStatus, string> = {
  verified: "Verificado", playable: "Jogável", unsupported: "Não suportado", unknown: "Sem avaliação",
};

/** `reports/summaries/<appid>.json` -> tier and report count; undefined for anything else. */
export function parseProtonDb(json: unknown): ProtonInfo | undefined {
  if (!isObj(json)) return undefined;
  const tier = TIERS.find((t) => t === json["tier"]);
  const total = json["total"];
  if (!tier || typeof total !== "number" || !Number.isInteger(total) || total < 0 || total > 10_000_000) return undefined;
  return { tier, total };
}

const DECK_BY_CATEGORY: Record<number, DeckStatus> = { 0: "unknown", 1: "unsupported", 2: "playable", 3: "verified" };

/** Steam's `ajaxgetdeckappcompatibilityreport` answer -> status; undefined when the store did not answer successfully. */
export function parseDeck(json: unknown): DeckStatus | undefined {
  if (!isObj(json) || json["success"] !== 1 || !isObj(json["results"])) return undefined;
  const cat = json["results"]["resolved_category"];
  return typeof cat === "number" && Object.prototype.hasOwnProperty.call(DECK_BY_CATEGORY, cat) ? DECK_BY_CATEGORY[cat] : undefined;
}

const PRODUCT_ID = /^[0-9A-Z]{12}$/;

/** The catalog list starts with a header object (`siglId`); every other entry is `{ id }`. Duplicates and malformed ids are dropped. */
export function parseGamePassIds(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  const seen = new Set<string>();
  for (const e of json) {
    if (isObj(e) && typeof e["id"] === "string" && PRODUCT_ID.test(e["id"])) seen.add(e["id"]);
  }
  return [...seen];
}

/** `displaycatalog` products -> titles. */
export function parseGamePassTitles(json: unknown): string[] {
  if (!isObj(json) || !Array.isArray(json["Products"])) return [];
  const out: string[] = [];
  for (const p of json["Products"]) {
    const lp = isObj(p) && Array.isArray(p["LocalizedProperties"]) ? p["LocalizedProperties"][0] : undefined;
    const title = isObj(lp) && typeof lp["ProductTitle"] === "string" ? lp["ProductTitle"].trim() : "";
    if (title && title.length <= 200) out.push(title);
  }
  return out;
}

/** Microsoft adds suffixes the other stores do not: "(Game Preview)", "(PC)", "- Windows Edition". */
const SUFFIX = /\s*(\((game preview|pc|windows|windows 10|windows edition|xbox)\)|-\s*windows( 10)? edition)\s*$/i;

export const catalogKey = (title: string): string => fold(title.replace(SUFFIX, ""));

export function gamePassIndex(titles: string[]): Set<string> {
  return new Set(titles.map(catalogKey).filter(Boolean));
}

export const inGamePass = (index: Set<string>, title: string): boolean => {
  const k = catalogKey(title);
  return k !== "" && index.has(k);
};
