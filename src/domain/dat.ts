/** CRC32 (8 uppercase hex) -> game name, read from a Logiqx XML DAT (No-Intro, Redump). */
export type DatIndex = Map<string, string>;

export const CRC32 = /^[0-9A-F]{8}$/;
const MAX_ENTRIES = 500_000;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescape = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? "";
    const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });

const attr = (tag: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
const attrValue = (tag: string, name: string) => {
  const m = attr(tag, name);
  return m ? unescape(m[1] ?? m[2] ?? "") : undefined;
};

/**
 * Only the Logiqx shape is read: `<game|machine name="..."> <rom ... crc="..."/> </game>`. No XML
 * engine, no external entities or DTD: tags are matched by pattern and attributes unescaped by hand.
 */
export function parseDat(text: string): DatIndex {
  const index: DatIndex = new Map();
  const games = /<(game|machine)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  for (let g = games.exec(text); g && index.size < MAX_ENTRIES; g = games.exec(text)) {
    const name = attrValue(g[2] ?? "", "name")?.trim();
    if (!name) continue;
    for (const rom of (g[3] ?? "").matchAll(/<rom\b([^>]*)\/?>/gi)) {
      const crc = attrValue(rom[1] ?? "", "crc")?.trim().toUpperCase();
      if (crc && CRC32.test(crc) && !index.has(crc)) index.set(crc, name);
    }
  }
  return index;
}
