import { sanitizeGame } from "./backup";
import { PLATFORM_BY_ID, PLATFORMS } from "./platforms";
import { PROVIDER_BY_ID, PROVIDERS } from "./providers";
import { fold } from "./scan/fold";
import { STATUS_LABEL, STATUS_ORDER } from "./status";
import { sanitizeTags } from "./tags";
import type { Game, PlayStatus } from "./types";

export const MAX_CSV_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 20_000;

/** RFC 4180 reader: quoted fields, doubled quotes, CRLF/LF, a leading BOM and `,` or `;` separators. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      if (rows.length > MAX_ROWS + 1) break;
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

/** A spreadsheet runs cells that start with these as formulas; a leading apostrophe keeps them text. */
const FORMULA = /^[=+\-@\t\r]/;
const cell = (v: string | number | undefined): string => {
  let s = v === undefined ? "" : String(v);
  if (FORMULA.test(s) && !(typeof v === "number")) s = `'${s}`;
  return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const CSV_HEADER = ["Title", "Platform", "Store", "Status", "Hours", "Rating", "HoursToBeat", "Tags", "Notes", "Year", "Genres", "Owned", "Installed"] as const;

export function gamesToCsv(games: Game[]): string {
  const lines = [CSV_HEADER.join(",")];
  for (const g of games) {
    lines.push([
      g.title, PLATFORM_BY_ID[g.platformId]?.name ?? g.platformId, PROVIDER_BY_ID[g.providerId]?.name ?? g.providerId, STATUS_LABEL[g.status],
      Math.round(g.playtimeH * 10) / 10, g.rating, g.hoursToBeat, (g.tags ?? []).join("; "), g.notes?.replace(/\r?\n/g, " "), g.year || undefined,
      g.genres.join("; "), g.owned ? "yes" : "no", g.installed ? "yes" : "no",
    ].map(cell).join(","));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

const HEADERS = {
  title: ["title", "name", "nome", "titulo", "game", "jogo"],
  platform: ["platform", "plataforma", "platforms"],
  store: ["store", "source", "loja", "provider", "library"],
  status: ["status", "completionstatus", "situacao"],
  hours: ["hours", "horas", "playtimehours", "playtime", "hoursplayed"],
  rating: ["rating", "nota", "userscore", "score"],
  toBeat: ["hourstobeat", "tempoparazerar", "timetobeat"],
  tags: ["tags", "categories", "categorias"],
  notes: ["notes", "notas", "notes"],
  year: ["year", "ano", "releaseyear"],
  genres: ["genres", "generos", "genre"],
  owned: ["owned", "comprado"],
  installed: ["installed", "instalado"],
} satisfies Record<string, string[]>;
type HeaderKey = keyof typeof HEADERS;

const STATUS_ALIASES: Record<string, PlayStatus> = {
  "not played": "backlog", "to play": "backlog", "plan to play": "backlog", jogar: "backlog", "quero jogar": "backlog",
  played: "playing", playing: "playing", jogando: "playing", "em andamento": "playing",
  beaten: "completed", completed: "completed", finished: "completed", zerado: "completed", concluido: "completed", "concluído": "completed",
  abandoned: "dropped", dropped: "dropped", abandonado: "dropped",
  wishlist: "wishlist", "lista de desejos": "wishlist", desejo: "wishlist",
};

function statusOf(raw: string | undefined): PlayStatus {
  const t = (raw ?? "").trim().toLowerCase();
  return STATUS_ORDER.find((s) => s === t) ?? STATUS_ORDER.find((s) => STATUS_LABEL[s].toLowerCase() === t) ?? STATUS_ALIASES[t] ?? "backlog";
}

const byName = <T extends { id: string; name: string }>(list: T[], v: string | undefined, fallback: string): string => {
  const k = fold(v ?? "");
  return list.find((x) => fold(x.name) === k || x.id === (v ?? "").trim().toLowerCase())?.id ?? fallback;
};

/** Undoes the apostrophe `cell` adds in front of formula-looking text, so export then import is lossless. */
const plain = (v: string | undefined): string | undefined => (v === undefined ? undefined : v.replace(/^'(?=[=+\-@\t\r])/, ""));

const number = (v: string | undefined): number | undefined => {
  const n = Number((v ?? "").trim().replace(",", "."));
  return v !== undefined && v.trim() !== "" && Number.isFinite(n) ? n : undefined;
};

export interface CsvImport {
  games: Game[];
  skipped: number;
  /** Titles already in the library (same folded title and store) are not added twice. */
  duplicates: number;
}

/** Turns CSV text into valid games. Unknown stores become "physical" (Coleção física), unknown platforms "pc". Nothing is trusted. */
export function csvToGames(text: string, existing: Game[], newId: () => string = () => crypto.randomUUID()): CsvImport | { error: string } {
  if (text.length > MAX_CSV_BYTES) return { error: "Arquivo grande demais." };
  const rows = parseCsv(text);
  const head = rows[0]?.map((h) => fold(h));
  if (!head) return { error: "O CSV está vazio." };
  const col = (key: HeaderKey) => head.findIndex((h) => (HEADERS[key] as string[]).includes(h));
  const idx = Object.fromEntries((Object.keys(HEADERS) as HeaderKey[]).map((k) => [k, col(k)])) as Record<HeaderKey, number>;
  if (idx.title < 0) return { error: 'Não encontrei a coluna de título (use "Title" ou "Name").' };

  const have = new Set(existing.map((g) => `${g.providerId}|${fold(g.title)}`));
  const out: Game[] = [];
  let skipped = 0, duplicates = 0;
  for (const r of rows.slice(1, MAX_ROWS + 1)) {
    const get = (k: HeaderKey) => (idx[k] >= 0 ? r[idx[k]] : undefined);
    const title = (plain(get("title")) ?? "").trim();
    const platformId = byName(PLATFORMS, get("platform"), "pc");
    const providerId = byName(PROVIDERS, get("store"), "physical");
    const status = statusOf(get("status"));
    const key = `${providerId}|${fold(title)}`;
    if (!title || !fold(title)) { skipped++; continue; }
    if (have.has(key)) { duplicates++; continue; }
    const game = sanitizeGame({
      id: newId(), title, platformId, providerId, status, owned: status !== "wishlist", installed: get("installed")?.trim().toLowerCase() === "yes",
      year: number(get("year")) ?? 0,
      genres: (get("genres") ?? "").split(/[;|]/).map((s) => s.trim()).filter(Boolean),
      playtimeH: number(get("hours")) ?? 0,
      rating: number(get("rating")),
      hoursToBeat: number(get("toBeat")),
      tags: sanitizeTags((plain(get("tags")) ?? "").split(/[;|]/)),
      notes: plain(get("notes"))?.trim() || undefined,
    });
    if (!game) { skipped++; continue; }
    have.add(key);
    out.push(game);
  }
  return { games: out, skipped, duplicates };
}
