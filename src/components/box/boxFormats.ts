import { PLATFORM_BY_ID } from "../../domain/platforms";

/** Retail package shape. Dimensions are CSS pixels at scale 1 and keep the real proportions. */
export type BoxFormat = "dvd" | "bluray" | "jewel" | "umd" | "card" | "ds" | "carton" | "cartonSm" | "clam";

/** What lives inside the package. */
export type MediaKind =
  | "disc" | "minidisc" | "umd" | "card" | "dscart"
  | "cart-snes" | "cart-nes" | "cart-n64" | "cart-gb" | "cart-gba" | "cart-md";

export interface BoxSpec {
  format: BoxFormat;
  w: number;
  h: number;
  d: number;
  media: MediaKind;
  /** Short name of the media, shown in the stage ("Blu-ray", "Cartucho 16-bit"). */
  mediaLabel: string;
  /** Verb phrase for the stage button ("o disco"). */
  take: string;
  /** Disc print / plastic tint. */
  tint: string;
}

const SIZE: Record<BoxFormat, [number, number, number]> = {
  dvd: [140, 196, 15],
  bluray: [140, 176, 14],
  jewel: [140, 124, 12],
  umd: [104, 156, 14],
  card: [108, 172, 12],
  ds: [116, 148, 14],
  carton: [196, 140, 34],
  cartonSm: [110, 140, 24],
  clam: [136, 192, 22],
};

const disc = (label: string, tint: string) => ({ media: "disc" as const, mediaLabel: label, take: "o disco", tint });

type Rule = Pick<BoxSpec, "format" | "media" | "mediaLabel" | "take" | "tint">;
const RULES: Record<string, Rule> = {
  pc: { format: "dvd", ...disc("Edição digital", "#e2e6ee") },
  ps1: { format: "jewel", ...disc("CD-ROM", "#1b1d26") },
  ps2: { format: "dvd", ...disc("DVD-ROM", "#c9d4f2") },
  ps3: { format: "bluray", ...disc("Blu-ray", "#d6dcee") },
  ps4: { format: "bluray", ...disc("Blu-ray", "#dfe6ff") },
  ps5: { format: "bluray", ...disc("Blu-ray Ultra HD", "#eef2ff") },
  psp: { format: "umd", media: "umd", mediaLabel: "UMD", take: "o UMD", tint: "#2a2f40" },
  vita: { format: "card", media: "card", mediaLabel: "Cartão de jogo", take: "o cartão", tint: "#1c1f2b" },
  xbox: { format: "dvd", ...disc("DVD-ROM", "#cfe3cf") },
  x360: { format: "dvd", ...disc("DVD-ROM", "#d3e6d3") },
  xone: { format: "bluray", ...disc("Blu-ray", "#dcefe0") },
  xsx: { format: "bluray", ...disc("Blu-ray Ultra HD", "#15201a") },
  nes: { format: "carton", media: "cart-nes", mediaLabel: "Cartucho 8-bit", take: "o cartucho", tint: "#9a9aa2" },
  snes: { format: "carton", media: "cart-snes", mediaLabel: "Cartucho 16-bit", take: "o cartucho", tint: "#b4b4bd" },
  n64: { format: "carton", media: "cart-n64", mediaLabel: "Cartucho 64-bit", take: "o cartucho", tint: "#8f8f98" },
  gc: { format: "dvd", media: "minidisc", mediaLabel: "Mini DVD", take: "o disco", tint: "#bcb2e8" },
  wii: { format: "dvd", ...disc("Disco Wii", "#f2f6fa") },
  wiiu: { format: "bluray", ...disc("Disco Wii U", "#e6f4fa") },
  switch: { format: "card", media: "card", mediaLabel: "Cartão de jogo", take: "o cartão", tint: "#2b2e3a" },
  gb: { format: "cartonSm", media: "cart-gb", mediaLabel: "Cartucho Game Boy", take: "o cartucho", tint: "#b8b8b0" },
  gbc: { format: "cartonSm", media: "cart-gb", mediaLabel: "Cartucho Game Boy", take: "o cartucho", tint: "#b8b8b0" },
  gba: { format: "cartonSm", media: "cart-gba", mediaLabel: "Cartucho Game Boy Advance", take: "o cartucho", tint: "#a9a9b8" },
  nds: { format: "ds", media: "dscart", mediaLabel: "Cartão DS", take: "o cartão", tint: "#2a2d36" },
  "3ds": { format: "ds", media: "dscart", mediaLabel: "Cartão 3DS", take: "o cartão", tint: "#2a2d36" },
  sms: { format: "clam", media: "cart-md", mediaLabel: "Cartucho", take: "o cartucho", tint: "#15161c" },
  genesis: { format: "clam", media: "cart-md", mediaLabel: "Cartucho 16-bit", take: "o cartucho", tint: "#15161c" },
  saturn: { format: "jewel", ...disc("CD-ROM", "#d9dbe8") },
  dc: { format: "jewel", ...disc("GD-ROM", "#f3e1c4") },
  gg: { format: "cartonSm", media: "cart-md", mediaLabel: "Cartucho", take: "o cartucho", tint: "#15161c" },
  atari2600: { format: "carton", media: "cart-nes", mediaLabel: "Cartucho", take: "o cartucho", tint: "#3b2a1e" },
  pce: { format: "cartonSm", media: "cart-gb", mediaLabel: "HuCard", take: "o cartão", tint: "#d8d3c4" },
  neogeo: { format: "clam", media: "cart-n64", mediaLabel: "Cartucho MVS", take: "o cartucho", tint: "#2b2b32" },
  arcade: { format: "dvd", ...disc("Imagem de disco", "#dcdce6") },
  dos: { format: "carton", ...disc("CD-ROM", "#d4d6de") },
};

/** Package shape, size and media for a platform. Unknown platforms get a plain disc case. */
export function boxSpecFor(platformId: string): BoxSpec {
  const rule = RULES[platformId] ?? RULES["pc"]!;
  const [w, h, d] = SIZE[rule.format];
  return { ...rule, w, h, d };
}

export function knownBoxPlatforms(): string[] {
  return Object.keys(RULES);
}

/** Greedy shelf packing: fills each row until the next box would overflow `avail`. */
export function layoutShelves(widths: number[], avail: number, gap: number): number[][] {
  const rows: number[][] = [[]];
  let used = 0;
  widths.forEach((w, i) => {
    const row = rows[rows.length - 1]!;
    if (row.length && used + w > avail) {
      rows.push([i]);
      used = w + gap;
    } else {
      row.push(i);
      used += w + gap;
    }
  });
  return rows[0]!.length ? rows : [];
}

/* Generated cover: deterministic from the title, tinted by the platform color. */
export type Motif = "sun" | "peaks" | "rings" | "blade" | "moon" | "grid" | "wave";
const MOTIFS: Motif[] = ["sun", "peaks", "rings", "blade", "moon", "grid", "wave"];

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface ArtSeed {
  motif: Motif;
  hue: number;
  dark: string;
  mid: string;
  light: string;
}

export function artSeed(title: string, platformId: string): ArtSeed {
  const h = hashString(title);
  const platformHue = hashString(PLATFORM_BY_ID[platformId]?.color ?? platformId) % 360;
  const hue = (h % 70 + platformHue) % 360;
  return {
    motif: MOTIFS[(h >>> 8) % MOTIFS.length]!,
    hue,
    dark: `hsl(${hue} 55% 10%)`,
    mid: `hsl(${(hue + 18) % 360} 62% 38%)`,
    light: `hsl(${(hue + 40) % 360} 85% 74%)`,
  };
}
