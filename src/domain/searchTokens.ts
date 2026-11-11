import type { GameFilter } from "./filter";
import { PLATFORM_BY_ID, PLATFORMS } from "./platforms";
import { PROVIDER_BY_ID, PROVIDERS } from "./providers";
import { STATUS_COLOR, STATUS_LABEL } from "./status";
import type { PlayStatus } from "./types";

/** One active filter shown as a removable chip inside the search box. */
export interface FilterChip {
  key: string;
  kind: "plataforma" | "status" | "loja" | "tag" | "filtro";
  label: string;
  color: string;
  /** Typed back into the box when the chip is removed with Backspace. */
  word: string;
  clear: Partial<GameFilter>;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[\s._/-]+/g, "");

const STATUS_WORDS: Record<string, PlayStatus> = {
  jogando: "playing", playing: "playing",
  backlog: "backlog", querojogar: "backlog", quero: "backlog",
  zerado: "completed", zerados: "completed", completo: "completed", completed: "completed",
  abandonado: "dropped", abandonados: "dropped", dropped: "dropped",
  wishlist: "wishlist", desejo: "wishlist",
};

const FLAG_WORDS: Record<string, keyof Pick<GameFilter, "installedOnly" | "ownedOnly" | "loanedOnly" | "multiStoreOnly">> = {
  instalado: "installedOnly", instalados: "installedOnly",
  comprado: "ownedOnly", comprados: "ownedOnly",
  emprestado: "loanedOnly", emprestados: "loanedOnly",
  duplicado: "multiStoreOnly", duplicados: "multiStoreOnly", multiloja: "multiStoreOnly", repetido: "multiStoreOnly", repetidos: "multiStoreOnly",
};

const FLAG_CHIP: Record<string, [string, string]> = {
  installedOnly: ["Instalados", "instalado"],
  ownedOnly: ["Comprados", "comprado"],
  loanedOnly: ["Emprestados", "emprestado"],
  multiStoreOnly: ["Em mais de uma loja", "duplicado"],
};

/** Store aliases people actually type; full names and ids match too. */
const PROVIDER_ALIASES: Record<string, string> = {
  battlenet: "battlenet", bnet: "battlenet", blizzard: "battlenet",
  ubi: "ubisoft", gamepass: "xbl", xboxlive: "xbl", eshop: "nintendo",
  fisico: "physical", fisica: "physical", rom: "roms", iso: "roms", isos: "roms",
};

function providerFor(word: string): string | undefined {
  if (PROVIDER_ALIASES[word]) return PROVIDER_ALIASES[word];
  return PROVIDERS.find((p) => p.id === word || fold(p.name) === word)?.id;
}

function platformFor(word: string): string | undefined {
  return PLATFORMS.find((p) => p.id === word || fold(p.short) === word || fold(p.name) === word)?.id;
}

/**
 * Turns one finished word ("ps2", "zerado", "steam", "#coop") into a filter patch,
 * or null when it is plain text for the title search.
 */
export function parseSearchWord(raw: string, current: GameFilter): Partial<GameFilter> | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("#") && trimmed.length > 1) return { tag: trimmed.slice(1) };
  const word = fold(trimmed);
  if (!word) return null;
  const platform = platformFor(word);
  if (platform) return { platformId: platform };
  const status = STATUS_WORDS[word];
  if (status) return { status };
  const flag = FLAG_WORDS[word];
  if (flag) return { [flag]: true };
  const provider = providerFor(word);
  if (provider) return current.providerIds.includes(provider) ? {} : { providerIds: [...current.providerIds, provider] };
  return null;
}

/**
 * Splits typed text into filter patches and the leftover title query. Only words that are
 * followed by a space (finished) are converted, so "epic mick" keeps typing freely.
 */
export function absorbTokens(text: string, current: GameFilter): { patch: Partial<GameFilter>; rest: string } {
  const finished = /\s$/.test(text);
  const words = text.split(/\s+/).filter(Boolean);
  const tail = finished ? "" : words.pop() ?? "";
  let filter = current;
  const rest: string[] = [];
  for (const w of words) {
    const patch = parseSearchWord(w, filter);
    if (patch) filter = { ...filter, ...patch };
    else rest.push(w);
  }
  const query = [...rest, tail].filter(Boolean).join(" ") + (finished && rest.length ? " " : "");
  const patch: Partial<GameFilter> = {};
  for (const k of Object.keys(filter) as (keyof GameFilter)[]) {
    if (k !== "query" && filter[k] !== current[k]) (patch as Record<string, unknown>)[k] = filter[k];
  }
  return { patch, rest: query };
}

/** The active filters, in the order they read best as chips. */
export function filterChips(f: GameFilter, lockInstalled = false): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.platformId) {
    const p = PLATFORM_BY_ID[f.platformId];
    chips.push({ key: "platform", kind: "plataforma", label: p?.short ?? f.platformId, color: p?.color ?? "#888", word: (p?.short ?? f.platformId).toLowerCase(), clear: { platformId: null } });
  }
  if (f.status) {
    chips.push({ key: "status", kind: "status", label: STATUS_LABEL[f.status], color: STATUS_COLOR[f.status], word: f.status === "backlog" ? "backlog" : fold(STATUS_LABEL[f.status]), clear: { status: null } });
  }
  for (const id of f.providerIds) {
    const p = PROVIDER_BY_ID[id];
    chips.push({ key: `store:${id}`, kind: "loja", label: p?.name ?? id, color: p?.color ?? "#888", word: id, clear: { providerIds: f.providerIds.filter((x) => x !== id) } });
  }
  if (f.tag) chips.push({ key: "tag", kind: "tag", label: f.tag, color: "#a56bff", word: `#${f.tag}`, clear: { tag: null } });
  for (const k of ["installedOnly", "ownedOnly", "loanedOnly", "multiStoreOnly"] as const) {
    if (!f[k] || (k === "installedOnly" && lockInstalled)) continue;
    const [label, word] = FLAG_CHIP[k]!;
    chips.push({ key: k, kind: "filtro", label, color: "#46f0c1", word, clear: { [k]: false } });
  }
  return chips;
}

/** Words offered under the search box while it is focused. */
export const SEARCH_SUGGESTIONS = ["ps2", "switch", "pc", "jogando", "zerado", "backlog", "steam", "gog", "instalado", "emprestado", "duplicado"];
